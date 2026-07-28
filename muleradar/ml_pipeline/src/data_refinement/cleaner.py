import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
import joblib
import os


class BOIDataRefiner:
    """
    Data Refinement Engine for the BOI mule account dataset.

    Handles:
      - Shadow "was_missing" indicator columns (missingness as a signal)
      - Context-aware imputation (zero-fill for count features, group-wise
        median for ratio features, median for everything else)
      - Leakage-safe categorical encoding (encoders are fit ONCE on training
        data and reused on unseen data via `transform`, never re-fit)
      - Leakage-safe numeric imputation (medians are fit ONCE on training
        data and reused on unseen/live data, never recomputed on the fly)
      - Removal of known leaky columns identified during EDA

    FIX (Jul 15 follow-up): the group-wise ratio imputation used to call
    `df.groupby(...).transform('median')` on whatever dataframe was passed
    in. That meant:
      1. Test-set medians were computed from the test set itself (leakage),
         and
      2. A single-row live inference call (see MuleRiskAnalyzer) produced a
         NaN/degenerate median since you can't take a meaningful median of
         one row.
    Now group medians (and the generic column medians used in the catch-all
    branch) are learned ONCE on the training data and stored on the fitted
    object, then just looked up / mapped onto new data - the same pattern
    already used for the LabelEncoders.
    """

    def __init__(self):
        # The exact 18 features requested by Bank of India
        self.important_features = [
            'F115', 'F321', 'F527', 'F531', 'F670', 'F1692', 'F2082', 'F2122',
            'F2582', 'F2678', 'F2737', 'F2956', 'F3043', 'F3836', 'F3887',
            'F3889', 'F3891', 'F3894'
        ]
        self.target_col = 'F3924'

        # Columns confirmed to leak the target during EDA (near-perfect
        # correlation with F3924, traced back to post-event fields that
        # wouldn't be available at prediction time in production).
        # These must NEVER be used as model inputs.
        self.leaky_columns = ['F3912', 'F2230']

        # Features that represent counts of events (e.g. transaction counts).
        # Missing -> genuinely "0 activity", not "unknown", so zero-fill.
        #
        # TODO(data-dictionary): FeatureFactory.engineer_features() treats
        # F2082/F2122 as raw transaction VOLUMES (inflow / cash-out amount)
        # and F2582/F2678 as transaction COUNTS, while this class currently
        # treats ALL FOUR as counts for imputation purposes. Confirm the real
        # semantics against the BOI data dictionary and align both files -
        # a volume column should probably NOT be zero-filled the same way a
        # count column is (a volume of 0 vs "unknown" are very different
        # assumptions for a ratio like pass_through_ratio).
        self.count_features = ['F2082', 'F2122', 'F2582', 'F2678']

        # Features that represent ratios (e.g. inward/outward ratios).
        # Missing -> impute with the median WITHIN the account's own type
        # group instead of a single global median, since ratio baselines
        # differ a lot between account types (savings vs current vs merchant).
        self.ratio_features = ['F527', 'F531', 'F670', 'F2956']
        self.account_type_col = 'F115'  # proxy account-type/category column

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
        cols_to_use = self.important_features + [self.target_col]

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

        FIX: filters down to the trained feature columns first, same as
        clean() does via usecols=... when loading from a file. Without
        this, a raw row pulled straight from the source CSV (which has
        ALL ~3924 raw F-columns, not just the 18 trained ones) would get
        run through imputation/encoding for every single column - crashing
        on any column that looks like text but was never seen during
        training (no fitted LabelEncoder for it), and along the way
        triggering severe DataFrame fragmentation from inserting hundreds
        of "_was_missing" columns one at a time.
        """
        cols_to_use = self.important_features + [self.target_col]
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
        # FIX: this used to decide WHICH columns get a "_was_missing"
        # shadow column by checking `df[col].isna().any()` on whatever
        # dataframe was passed in. That's fine for the full training set,
        # but at single-row live inference, a lone row essentially never
        # has NaNs in the same columns the training set did - so the
        # resulting column list didn't match what the model was trained
        # on, and XGBoost rejected it with a "feature_names mismatch"
        # error (this is the same class of bug as the group-median
        # leakage fixed earlier: deciding structure from the data slice
        # you're given, instead of learning it once on training data).
        #
        # Now the set of columns that get a shadow indicator is learned
        # ONCE during training and stored on self.was_missing_columns,
        # then applied identically (same columns, in the same order) at
        # both train and inference time - even if a given inference row
        # has no missing values at all, it still gets the same shadow
        # columns, just filled with 0.
        print("Creating shadow 'was_missing' indicator columns...")
        if is_training:
            self.was_missing_columns = [
                col for col in df.columns
                if col != self.target_col and df[col].isna().any()
            ]
        # Build all shadow columns in one shot via pd.concat instead of
        # inserting them one at a time (df[new_col] = ... in a loop),
        # which is what triggered pandas' "DataFrame is highly
        # fragmented" PerformanceWarning during training - purely a
        # performance fix, doesn't change the resulting values.
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
            if col == self.target_col or col.endswith('_was_missing'):
                continue

            # NOTE: pandas 3.0+ defaults text columns to a native 'str'
            # dtype instead of 'object', so a plain `dtype == 'object'`
            # check silently misses categorical columns on newer pandas
            # (they'd fall through to the numeric median branch and
            # crash). is_object_dtype/is_string_dtype covers both old and
            # new pandas behavior.
            is_text_col = (
                pd.api.types.is_object_dtype(df[col])
                or pd.api.types.is_string_dtype(df[col])
            )
            if is_text_col and col in self.onehot_columns:
                df[col] = df[col].fillna('Missing').astype(str)

                if is_training:
                    # Fixed, sorted category list learned once - sorting
                    # keeps column order deterministic across runs.
                    self.onehot_categories[col] = sorted(df[col].unique().tolist())

                categories = self.onehot_categories.get(col, [])
                dummies = {}
                for cat in categories:
                    safe_cat = ''.join(ch if ch.isalnum() else '_' for ch in str(cat))
                    dummies[f"{col}_is_{safe_cat}"] = (df[col] == cat).astype(int)
                # A category never seen during training (or genuinely
                # absent from a single inference row) simply matches none
                # of the learned dummy columns - safe, doesn't crash,
                # doesn't change the schema.
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
                # This is a constant fill, not a learned statistic, so it's
                # safe to apply identically at train and inference time.
                df[col] = df[col].fillna(0)

            elif col in self.ratio_features and self.account_type_col in df.columns:
                if is_training:
                    # Learn the group medians ONCE, from training data only.
                    group_medians = df.groupby(self.account_type_col)[col].median()
                    self.ratio_group_medians[col] = group_medians.to_dict()
                    self.ratio_global_medians[col] = float(df[col].median())

                group_map = self.ratio_group_medians.get(col, {})
                global_fallback = self.ratio_global_medians.get(col, 0.0)

                # Map each row's account type to the *training-set* median
                # for that group. Account types never seen during training
                # (or a live single-row lookup, where a group median can't
                # be computed from one row) fall back to the global median.
                mapped_group_median = df[self.account_type_col].map(group_map)
                df[col] = df[col].fillna(mapped_group_median)
                df[col] = df[col].fillna(global_fallback)

            else:
                if is_training:
                    self.fitted_medians[col] = float(df[col].median())
                fallback = self.fitted_medians.get(col, 0.0)
                df[col] = df[col].fillna(fallback)

        # Add all one-hot dummy columns in a single concat (avoids the
        # same fragmentation issue fixed earlier for the shadow columns).
        if onehot_frames:
            df = pd.concat([df] + onehot_frames, axis=1)

        if is_training:
            self._is_fitted = True
        return df