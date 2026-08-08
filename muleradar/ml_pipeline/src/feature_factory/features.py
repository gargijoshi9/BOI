import pandas as pd
import numpy as np


class FeatureFactory:
    """
    Fraud Feature Factory: engineers domain-specific "Behavioral DNA"
    features on top of the cleaned BOI feature set.

    DAY-1 FIX (data-dictionary reconciliation): matched every column
    this class touches against the official BOI data dictionary and
    corrected several wrong semantic assumptions:

      - `inflow_col`/`cash_out_col` previously pointed at F2082/F2122
        and were labeled "inflow volume" / "cash-out volume". Per the
        dictionary they are actually:
            F2082 = AVG_NET_BNKING_TXNS_DB_L14D - a net-banking DEBIT
                    (i.e. OUTWARD) transaction COUNT, not an inflow.
            F2122 = AVG_CASH_TXNS_L31D - a direction-ambiguous cash
                    transaction COUNT, not a volume/amount.
        Neither is a volume, and F2082 was backwards (outward, not
        inflow). This made the original Pass-Through Ratio compute
        something close to the wrong direction.

      - `inward_tx_count_col`/`outward_tx_count_col` pointed at
        F2582/F2678, labeled as transaction "counts". Per the
        dictionary both are AMOUNT DEVIATIONS ("Deviation of avgs: of
        ... Amount"), not counts at all, and F2678 is direction-
        agnostic ("Total Amount"), not "outward".

      - `counterparty_col` pointed at F2956, labeled "distinct
        counterparties". Per the dictionary F2956 is a deviation metric
        ("Deviation of total from avg: ... Credit txns"). A full-text
        search of the entire ~3924-column data dictionary for anything
        resembling "unique counterparty / beneficiary / payee" returned
        ZERO matches - this dataset has NO real counterparty-count
        column at all. `add_narrow_network_flag` (and the
        `cash_network_interaction` feature that depended on it) were
        computing a "network breadth" signal on a metric that has
        nothing to do with counterparties. Both are DEPRECATED below
        rather than kept and silently wrong - see their docstrings.

    Real, clean total credit/debit AMOUNT columns DO exist in the wider
    dataset (F3800 = TOT_TXNAMT_CR_L31D, F3801 = TOT_TXNAMT_DB_L31D) -
    they are not among the bank's 18 finalized features, but nothing
    stops us from adding them (BOI explicitly force-includes the 18 as a
    floor, not a ceiling - see hackathon_report.md's feature-selection
    section). This class now uses them for a CORRECT, unit-consistent
    Pass-Through Ratio / Inward Concentration when present, and falls
    back to a clearly-labeled, weaker count-based proxy when they are
    not (e.g. if BOIDataRefiner is ever run without loading them).
    """

    def __init__(self, use_amount_totals: bool = True):
        self._is_fitted = False
        self.use_amount_totals = use_amount_totals

        # --- Column roles, corrected against the real data dictionary ---

        # Real, unambiguous counts (kept from the original 18):
        self.cash_debit_count_col = 'F1692'      # CASH_TXNS_DB_L14D - Cash Debit Txns, last 14D
        self.netbank_debit_count_col = 'F2082'   # AVG_NET_BNKING_TXNS_DB_L14D - avg net-banking DEBIT txn count
        self.cash_txn_count_col = 'F2122'        # AVG_CASH_TXNS_L31D - avg cash txn count (direction-ambiguous)

        # Real amount-deviation signals (kept, relabeled honestly - not
        # counts, not "inward"/"outward" counts):
        self.upi_credit_amt_dev_col = 'F2582'    # DA_UPI_TXN_CR_L7_14D - UPI CREDIT amount deviation (genuinely inward-flavored)
        self.elec_xfer_amt_dev_col = 'F2678'     # DA_ELEC_XFER_AMT_L14_31D - electronic transfer amount deviation (direction-agnostic)

        # Clean total amount columns - NOT in the bank's 18, loaded only
        # if BOIDataRefiner was configured to include them (see
        # cleaner.py Day-3 notes). Used when present for a properly
        # unit-consistent pass-through / inward-concentration ratio.
        self.total_credit_amt_col = 'F3800'      # TOT_TXNAMT_CR_L31D
        self.total_debit_amt_col = 'F3801'       # TOT_TXNAMT_DB_L31D

        # Account tenure bucket, used for the (previously missing)
        # Account Freshness Flag described in hackathon_report.md
        # Section 6 but never implemented in code.
        self.tenure_bucket_col = 'F3889'         # ACCT_OPN_DAYS - "Number of days since account opened (buckets)"
        self._fresh_bucket_values = {'L7D', 'L31D'}

    def _safe_ratio(self, numerator: pd.Series, denominator: pd.Series) -> pd.Series:
        """Ratio that returns 0 instead of inf/NaN when denominator is 0."""
        denom = denominator.replace(0, np.nan)
        ratio = numerator / denom
        return ratio.fillna(0.0)

    def add_pass_through_ratio(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Pass-Through Ratio: how much of the money that comes IN gets moved
        OUT almost immediately. Mule accounts act as pipes, not stores of
        value, so this ratio trends close to 1.0 for mule accounts and
        much lower for normal customer accounts.

        Correct (amount-based) form, used when the amount totals are
        available: debit_amount / credit_amount.

        FALLBACK form (bank's 18 only, no amount totals): the 18 do not
        contain a clean inward/outward AMOUNT pair - the closest available
        signal is cash-debit-count vs. net-banking-debit-count, which is
        an "outflow channel mix" proxy, NOT a true pass-through ratio (it
        says nothing about how much of what came IN went back out). This
        fallback is intentionally named differently
        (`cash_debit_channel_ratio`) so it is never confused with a real
        pass-through signal downstream (e.g. in SHAP explanations shown
        to investigators).
        """
        has_totals = (
            self.use_amount_totals
            and self.total_credit_amt_col in df.columns
            and self.total_debit_amt_col in df.columns
        )
        if has_totals:
            df['pass_through_ratio'] = self._safe_ratio(
                df[self.total_debit_amt_col], df[self.total_credit_amt_col]
            )
            df['pass_through_ratio'] = df['pass_through_ratio'].clip(0, 5)
        elif self.cash_debit_count_col in df.columns and self.netbank_debit_count_col in df.columns:
            total_debit_channels = df[self.cash_debit_count_col] + df[self.netbank_debit_count_col]
            df['cash_debit_channel_ratio'] = self._safe_ratio(
                df[self.cash_debit_count_col], total_debit_channels
            )
        return df

    def add_inward_concentration(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Inward Concentration: ratio of inward transaction AMOUNT to total
        transaction amount. A high value means funds are being centrally
        routed INTO the account without a matching pattern of outward
        spending - a classic collection-point mule signature.

        Correct (amount-based) form, used when the amount totals are
        available: credit_amount / (credit_amount + debit_amount).

        FALLBACK form: skipped entirely (rather than computed on the
        wrong columns) when the amount totals aren't available, since
        the bank's 18 have no genuine "inward count/amount" signal to
        build this from without misrepresenting an amount-deviation
        column as a count.
        """
        has_totals = (
            self.use_amount_totals
            and self.total_credit_amt_col in df.columns
            and self.total_debit_amt_col in df.columns
        )
        if has_totals:
            total_amt = df[self.total_credit_amt_col] + df[self.total_debit_amt_col]
            df['inward_concentration'] = self._safe_ratio(df[self.total_credit_amt_col], total_amt)
        return df

    def add_sudden_activation(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Sudden Activation (revised): flags accounts with disproportionately
        high cash-debit activity relative to their general (net-banking)
        transaction activity level.

        NOTE: the original design paired cash-out volume against a
        "counterparty count" to approximate dormancy-then-activation.
        No counterparty-count column exists anywhere in this dataset
        (confirmed against the full data dictionary), so that framing
        has been dropped. This revised version is a genuine, available
        signal (cash-debit intensity vs. general banking activity) but
        it is weaker than true dormancy detection - true dormancy would
        need a tenure/inactivity-window column, which isn't among the
        bank's 18 either. Revisit once F3888 (ACCT_OPN_DATE) or a real
        transaction-history table is available.
        """
        if self.cash_debit_count_col in df.columns and self.netbank_debit_count_col in df.columns:
            activity_norm = df[self.netbank_debit_count_col] + 1
            df['sudden_activation'] = self._safe_ratio(df[self.cash_debit_count_col], activity_norm)
            df['sudden_activation'] = df['sudden_activation'].clip(
                lower=0, upper=df['sudden_activation'].quantile(0.99)
            )
        return df

    def add_narrow_network_flag(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        DEPRECATED (Day-1 fix): the original implementation flagged
        accounts with a low value of F2956, on the assumption F2956 was
        a "distinct counterparty count". Per the data dictionary, F2956
        is actually a deviation metric
        (D_TA_CI_NON_CASH_CHQ_TXN_CR_L14D), not a counterparty count -
        and no counterparty-count column exists anywhere in this
        dataset. Computing "narrow network" off the wrong column would
        silently mislabel accounts. This method is now a no-op and
        returns df unchanged; revisit only if a real
        counterparty/beneficiary-count column becomes available (e.g.
        from a genuine transaction ledger, per the GNN network-layer
        design in the report).
        """
        return df

    def add_account_freshness_flag(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Account Freshness Flag: 1 if the account's tenure bucket
        (F3889 = ACCT_OPN_DAYS) is 'L7D' or 'L31D' - i.e. opened within
        roughly the last 31 days. New accounts showing high transaction
        volume are disproportionately associated with mule activity;
        fraudsters open accounts specifically for a campaign and
        activate them immediately.

        Described in hackathon_report.md Section 6 but never actually
        implemented - added here. Guards against F3889 having already
        been numerically encoded upstream (BOIDataRefiner label/one-hot
        encodes text columns) by checking dtype before comparing to the
        raw bucket strings; if it's already numeric, this is skipped
        rather than silently producing an all-zero flag.
        """
        if self.tenure_bucket_col not in df.columns:
            return df
        col = df[self.tenure_bucket_col]
        if pd.api.types.is_numeric_dtype(col):
            # Already encoded upstream (e.g. label-encoded) - the raw
            # bucket strings ('L7D', 'L31D', ...) are no longer present,
            # so this flag can't be computed correctly here. Caller
            # should engineer this BEFORE categorical encoding if it
            # wants to use this method; skip rather than guess.
            return df
        df['account_freshness_flag'] = col.astype(str).isin(self._fresh_bucket_values).astype(int)
        return df

    def engineer_features(self, df: pd.DataFrame, is_training: bool = True) -> pd.DataFrame:
        print("Engineering features...")
        df_features = df.copy()

        target = None
        if 'F3924' in df_features.columns:
            target = df_features['F3924']
            df_features = df_features.drop(columns=['F3924'])

        # --- Behavioral DNA feature construction ---
        # NOTE: add_account_freshness_flag must run BEFORE F3889 is
        # categorically encoded by BOIDataRefiner if you want it driven
        # off the raw bucket strings. If BOIDataRefiner.clean_dataframe()
        # has already run (the normal pipeline order), F3889 will already
        # be numeric and this becomes a documented no-op - see its
        # docstring. Left in the call chain so it activates automatically
        # once the ordering is revisited (tracked as a Day-2/3 follow-up).
        df_features = self.add_account_freshness_flag(df_features)
        df_features = self.add_pass_through_ratio(df_features)
        df_features = self.add_inward_concentration(df_features)
        df_features = self.add_sudden_activation(df_features)
        df_features = self.add_narrow_network_flag(df_features)  # no-op, see docstring

        # cash_network_interaction previously multiplied pass_through_ratio
        # by narrow_network_flag. narrow_network_flag is deprecated (see
        # above), so this interaction term is no longer computed - it
        # would just equal 0 or a duplicate of pass_through_ratio, adding
        # noise rather than signal.

        self._is_fitted = True

        if target is not None:
            df_features['F3924'] = target.values

        return df_features