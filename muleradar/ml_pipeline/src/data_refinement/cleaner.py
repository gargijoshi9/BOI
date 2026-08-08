import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
import joblib
import os


class BOIDataRefiner:
    """
    Data Refinement Engine for the BOI mule account dataset.

    DAY-1 FIX (data-dictionary reconciliation): the official BOI column
    description sheet ("Description.xlsx" / Data_Dicitionary sheet) was
    matched against every one of the 18 bank-finalized feature codes.
    Several of the original semantic assumptions in this class were
    wrong. Concretely, per the real dictionary:

      - F115 ("R_CI_NON_CASH_CHQ_TXN_L14_31D") is a RATIO, not an
        account-type/category column. It was previously used as
        `account_type_col` to group-by for ratio imputation, which
        means the group-wise median imputation was grouping by a
        near-continuous value instead of a real category - functionally
        close to no grouping at all, just with extra noise.
        The REAL account-type proxy is F3886 ("PRODUCT_NAME" - "Product
        name of the corresponding account"). It isn't one of the bank's
        18 finalized features, so it's loaded here ONLY as an auxiliary
        grouping key (see `auxiliary_grouping_columns`) and dropped
        before the cleaned dataframe is returned - it never reaches the
        model as an input feature, exactly like `leaky_columns`.

      - F670 ("MIN_UPI_XFER_TXNS_L7D") is a transaction COUNT ("Min UPI
        Total Txns"), not a ratio. It was incorrectly sitting in
        `ratio_features` (group-median imputed). Moved to
        `count_features` (zero-filled) - this also matches what
        hackathon_report.md's Data Refinement section already claimed
        ("zero-fill for count features like F670 and F1692"), which the
        code had never actually implemented.

      - F1692 ("CASH_TXNS_DB_L14D") is likewise a real count ("Cash
        Debit Txns") and is now explicitly zero-filled instead of
        falling through to the generic column-median branch.

      - F2582 ("DA_UPI_TXN_CR_L7_14D") and F2678
        ("DA_ELEC_XFER_AMT_L14_31D") are AMOUNT DEVIATIONS, not counts
        ("Deviation of avgs: of ... Amount"). They were incorrectly
        sitting in `count_features` (zero-filled, which silently
        invents "zero deviation" for missing rows instead of using a
        sensible statistical fallback). Moved to the generic
        median-imputation branch.

      - F2956 ("D_TA_CI_NON_CASH_CHQ_TXN_CR_L14D") is a deviation
        metric, not a ratio, and was incorrectly sitting in
        `ratio_features`. Moved to the generic median branch. (It was
        also being misused elsewhere as a "counterparty count" proxy in
        FeatureFactory - see features.py's own fix notes; the dataset
        has no real counterparty/beneficiary-count column anywhere in
        its ~3924 columns, confirmed by a full-text search of the data
        dictionary.)

      - F321 ("RA_NON_CASH_CHQ_AMT_L7_14D") IS a genuine ratio
        ("Ratio of avgs...") but was never in `ratio_features` at all -
        it was falling through to the generic median branch. Added.

    Everything else (F527, F531 as ratios; F2082/F2122 as counts; F3891
    one-hot; leaky-column handling; shadow "was_missing" columns) was
    already correct per the dictionary and is unchanged.

    Handles:
      - Shadow "was_missing" indicator columns (missingness as a signal)
      - Context-aware imputation (zero-fill for count features, group-wise
        median for ratio features, median for everything else)
      - Leakage-safe categorical encoding (encoders are fit ONCE on training
        data and reused on unseen data via `transform`, never re-fit)
      - Leakage-safe numeric imputation (medians are fit ONCE on training
        data and reused on unseen/live data, never recomputed on the fly)
      - Removal of known leaky columns identified during EDA
    """

    def __init__(self, use_amount_totals: bool = True):
        # The exact 18 features requested by Bank of India
        self.important_features = [
            'F115', 'F321', 'F527', 'F531', 'F670', 'F1692', 'F2082', 'F2122',
            'F2582', 'F2678', 'F2737', 'F2956', 'F3043', 'F3836', 'F3887',
            'F3889', 'F3891', 'F3894'
        ]
        self.target_col = 'F3924'

        # DAY-1 FIX: optionally load the two clean total-amount columns
        # (F3800 = TOT_TXNAMT_CR_L31D, F3801 = TOT_TXNAMT_DB_L31D). They
        # are NOT among the bank's 18 finalized features but are needed
        # by FeatureFactory to compute a correct, unit-consistent
        # Pass-Through Ratio / Inward Concentration (see features.py's
        # docstring). Kept as real model inputs (unlike
        # auxiliary_grouping_columns below, these are NOT dropped before
        # returning). Must be kept in sync with the `use_amount_totals`
        # flag passed to FeatureFactory in train.py / analyzer.py -
        # mismatched flags mean the amount-based ratios silently fall
        # back to the weaker proxy.
        self.use_amount_totals = use_amount_totals
        self.amount_total_columns = ['F3800', 'F3801'] if use_amount_totals else []
        self.important_features = self.important_features + self.amount_total_columns

        # Columns confirmed to leak the target during EDA (near-perfect
        # correlation with F3924, traced back to post-event fields that
        # wouldn't be available at prediction time in production).
        # These must NEVER be used as model inputs.
        #
        # NOTE: F2230 ("MNTH" - Month of the data) is also currently
        # treated as a drop candidate for MODEL FEATURES, but per the
        # data dictionary it's a genuine time/snapshot column - it
        # should be extracted and used as the out-of-time split key in
        # train.py BEFORE this class ever sees/drops it, not silently
        # discarded. See train.py's _CANDIDATE_DATE_COLUMNS fix.
        self.leaky_columns = ['F3912', 'F2230']

        # Features that represent counts of events (e.g. transaction counts).
        # Missing -> genuinely "0 activity", not "unknown", so zero-fill.
        #
        # DAY-1 FIX: corrected against the real data dictionary.
        #   F2082 AVG_NET_BNKING_TXNS_DB_L14D - Average Net Banking Debit
        #         Txns - last 14D (genuine count)
        #   F2122 AVG_CASH_TXNS_L31D - Average Cash Transaction Count -
        #         last 31D (genuine count)
        #   F670  MIN_UPI_XFER_TXNS_L7D - Min UPI Total Txns - last 7D
        #         (genuine count; moved OUT of ratio_features)
        #   F1692 CASH_TXNS_DB_L14D - Cash Debit Txns - last 14D
        #         (genuine count; previously fell through to generic median)
        # F2582 and F2678 were REMOVED from this list - see class
        # docstring, they are amount deviations, not counts.
        self.count_features = ['F2082', 'F2122', 'F670', 'F1692']

        # Features that represent ratios (e.g. inward/outward ratios).
        # Missing -> impute with the median WITHIN the account's own type
        # group instead of a single global median, since ratio baselines
        # differ a lot between account types (savings vs current vs merchant).
        #
        # DAY-1 FIX: F670 and F2956 REMOVED (not actually ratios - see
        # docstring). F321 ADDED (genuinely a ratio, was previously
        # falling through to the generic median branch unimputed by
        # group).
        self.ratio_features = ['F321', 'F527', 'F531']

        # DAY-1 FIX: account_type_col now points at the REAL product/
        # account-type column (F3886 = PRODUCT_NAME), not F115 (which is
        # itself a ratio feature, not a category). F3886 is not one of
        # the bank's 18 finalized features, so it is loaded ONLY as an
        # auxiliary grouping key via `auxiliary_grouping_columns` below
        # and is always dropped before the cleaned dataframe is returned
        # - it never becomes a model input.
        self.account_type_col = 'F3886'
        self.auxiliary_grouping_columns = [self.account_type_col]

        self.label_encoders = {}

        # NEW: columns to one-hot encode instead of label-encode.
        # F3891 (occupation) showed a real, sample-backed elevated mule
        # rate for 'student' accounts (1.94% vs ~0.89% baseline, n=1185 -
        # not noise) - see EDA. LabelEncoder assigns it an arbitrary
        # alphabetical integer, forcing the model to reconstruct
        # "is this a student account" via multiple splits on a
        # meaningless numeric ordering. One-hot gives it a direct binary
        # split instead. Kept to just this one column since it's small,
        # fixed cardinality (7 categories) - not applied broadly, since
        # one-hot on a high-cardinality column would blow up dimensionality.
        self.onehot_columns = ['F3891']
        # onehot_categories[col] -> list of category values seen during
        # training, in a fixed order. Learned ONCE at training time and
        # reused identically at inference (same pattern as
        # ratio_group_medians/fitted_medians/was_missing_columns below) -
        # a category never seen during training (or simply absent from a
        # single inference row) safely produces all-zero dummy columns
        # instead of crashing or silently changing the schema.
        self.onehot_categories = {}

        # Learned-on-training-data imputation statistics (leakage-safe).
        # ratio_group_medians[col] -> {account_type_value: median}
        # ratio_global_medians[col] -> single fallback median (used when a
        #   group value at inference time was never seen during training,
        #   or when there's only one row and no group median can be formed)
        # fitted_medians[col] -> plain column median, for the generic
        #   "else" branch (non-count, non-ratio numeric columns)
        self.ratio_group_medians = {}
        self.ratio_global_medians = {}
        self.fitted_medians = {}
        self.was_missing_columns = []

        self._is_fitted = False

    def clean(self, file_path: str, is_training: bool = True) -> pd.DataFrame:
        print(f"Loading data from {file_path}...")
        # DAY-1 FIX: also load the auxiliary grouping column(s) (e.g.
        # F3886) alongside the bank's 18 + target, so group-wise ratio
        # imputation has a real category to group by. These are dropped
        # again at the very end of _clean_dataframe(), same treatment as
        # leaky_columns - they are never a model input.
        cols_to_use = self.important_features + [self.target_col] + self.auxiliary_grouping_columns

        try:
            df = pd.read_csv(file_path, usecols=lambda c: c in cols_to_use)
        except ValueError:
            print("Warning: Not all BOI columns found. Loading available columns...")
            df = pd.read_csv(file_path)
            available_cols = [c for c in cols_to_use if c in df.columns]
            df = df[available_cols]

        return self._clean_dataframe(df, is_training=is_training)

    def clean_dataframe(self, df: pd.DataFrame, is_training: bool = False) -> pd.DataFrame:
        """
        Same cleaning logic as `clean()`, but takes an in-memory dataframe
        instead of a file path. This is what MuleRiskAnalyzer should call
        for single-row / live inference, instead of re-implementing (or
        skipping) the cleaning steps inline.

        Filters down to the trained feature columns first (now including
        the auxiliary grouping column, if present in the source row),
        same as clean() does via usecols=... when loading from a file.
        """
        cols_to_use = self.important_features + [self.target_col] + self.auxiliary_grouping_columns
        available_cols = [c for c in cols_to_use if c in df.columns]
        filtered = df[available_cols].copy()
        return self._clean_dataframe(filtered, is_training=is_training)

    def _clean_dataframe(self, df: pd.DataFrame, is_training: bool) -> pd.DataFrame:
        # --- Drop known leakage sources before anything else touches them ---
        dropped = [c for c in self.leaky_columns if c in df.columns]
        if dropped:
            print(f"Dropping leaky columns from target encoding: {dropped}")
            df = df.drop(columns=dropped)

        # --- Shadow missingness indicators (preserve absence-of-activity signal) ---
        #
        # The set of columns that get a shadow indicator is learned ONCE
        # during training and stored on self.was_missing_columns, then
        # applied identically (same columns, in the same order) at both
        # train and inference time.
        #
        # NOTE: the auxiliary grouping column (F3886) is intentionally
        # excluded from shadow-column consideration below via the
        # `col in self.auxiliary_grouping_columns` check - it's dropped
        # entirely before this dataframe is returned, so a
        # "F3886_was_missing" indicator would be dead weight.
        print("Creating shadow 'was_missing' indicator columns...")
        if is_training:
            self.was_missing_columns = [
                col for col in df.columns
                if col != self.target_col
                and col not in self.auxiliary_grouping_columns
                and df[col].isna().any()
            ]
        shadow_cols = {}
        for col in self.was_missing_columns:
            if col in df.columns:
                shadow_cols[f"{col}_was_missing"] = df[col].isna().astype(int)
            else:
                shadow_cols[f"{col}_was_missing"] = 0
        if shadow_cols:
            df = pd.concat([df, pd.DataFrame(shadow_cols, index=df.index)], axis=1)

        # --- Context-aware imputation + categorical encoding ---
        print("Handling missing values and encoding text...")
        onehot_frames = []
        for col in list(df.columns):
            if (
                col == self.target_col
                or col.endswith('_was_missing')
                or col in self.auxiliary_grouping_columns
            ):
                continue

            is_text_col = (
                pd.api.types.is_object_dtype(df[col])
                or pd.api.types.is_string_dtype(df[col])
            )
            if is_text_col and col in self.onehot_columns:
                df[col] = df[col].fillna('Missing').astype(str)

                if is_training:
                    self.onehot_categories[col] = sorted(df[col].unique().tolist())

                categories = self.onehot_categories.get(col, [])
                dummies = {}
                for cat in categories:
                    safe_cat = ''.join(ch if ch.isalnum() else '_' for ch in str(cat))
                    dummies[f"{col}_is_{safe_cat}"] = (df[col] == cat).astype(int)
                onehot_frames.append(pd.DataFrame(dummies, index=df.index))
                df = df.drop(columns=[col])

            elif is_text_col:
                df[col] = df[col].fillna('Missing')
                if is_training:
                    le = LabelEncoder()
                    df[col] = le.fit_transform(df[col].astype(str))
                    self.label_encoders[col] = le
                else:
                    le = self.label_encoders.get(col)
                    if le is None:
                        raise ValueError(
                            f"No fitted encoder found for '{col}'. "
                            f"Call clean(..., is_training=True) first."
                        )
                    known = set(le.classes_)
                    df[col] = df[col].astype(str).apply(lambda v: v if v in known else 'Missing')
                    if 'Missing' not in known:
                        df[col] = df[col].apply(lambda v: v if v in known else le.classes_[0])
                    df[col] = le.transform(df[col])

            elif col in self.count_features:
                # No activity recorded -> zero, not "average" activity.
                df[col] = df[col].fillna(0)

            elif col in self.ratio_features and self.account_type_col in df.columns:
                if is_training:
                    group_medians = df.groupby(self.account_type_col)[col].median()
                    self.ratio_group_medians[col] = group_medians.to_dict()
                    self.ratio_global_medians[col] = float(df[col].median())

                group_map = self.ratio_group_medians.get(col, {})
                global_fallback = self.ratio_global_medians.get(col, 0.0)

                mapped_group_median = df[self.account_type_col].map(group_map)
                df[col] = df[col].fillna(mapped_group_median)
                df[col] = df[col].fillna(global_fallback)

            else:
                if is_training:
                    self.fitted_medians[col] = float(df[col].median())
                fallback = self.fitted_medians.get(col, 0.0)
                df[col] = df[col].fillna(fallback)

        # Add all one-hot dummy columns in a single concat (avoids
        # DataFrame fragmentation).
        if onehot_frames:
            df = pd.concat([df] + onehot_frames, axis=1)

        # --- Drop the auxiliary grouping column(s) - they were loaded
        # ONLY to enable group-wise ratio imputation above and must
        # never reach the model as an input feature. ---
        aux_present = [c for c in self.auxiliary_grouping_columns if c in df.columns]
        if aux_present:
            df = df.drop(columns=aux_present)

        if is_training:
            self._is_fitted = True
        return df