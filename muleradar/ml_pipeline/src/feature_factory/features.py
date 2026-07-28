import pandas as pd
import numpy as np


class FeatureFactory:
    """
    Fraud Feature Factory: engineers domain-specific "Behavioral DNA"
    features on top of the cleaned BOI feature set.

    FIX: dropped StandardScaler. XGBoost/LightGBM split on raw thresholds
    and are invariant to monotonic scaling, so scaling bought nothing for
    the ensemble - but it was actively harmful for this use case:
      - SHAP contributions (see MuleRiskAnalyzer._explain) were being
        computed in *scaled* space, so a compliance analyst reading
        "pass_through_ratio contributed 0.42" had no way to map that back
        to an interpretable, real-world ratio. That's a real problem for
        an AML tool where "why was this account flagged" needs to be
        explainable to a human reviewer.
      - It added a second stateful artifact (feature_factory.pkl) that had
        to be kept perfectly in sync with the model, for a step with zero
        payoff for tree-based models.

    If you later add a non-tree model (logistic regression, neural net) to
    the ensemble, scaling should be reintroduced *for that model's inputs
    only*, fit on training data, and SHAP/reporting should always be done
    against the unscaled values.
    """

    def __init__(self):
        self._is_fitted = False

        # Column roles used by the engineered features below. These map
        # to placeholder BOI feature codes standing in for the underlying
        # concepts (inflow amount, outflow/cash-out amount, inward tx count,
        # outward tx count, counterparty count) until the real column
        # mapping from the data dictionary is confirmed.
        #
        # TODO(data-dictionary): see the matching TODO in
        # BOIDataRefiner.count_features - F2082/F2122/F2582/F2678 are
        # currently double-booked as both "counts" (cleaner.py) and
        # "volumes/counts" (here). Confirm real semantics before the demo.
        self.inflow_col = 'F2082'          # total inward transaction volume
        self.cash_out_col = 'F2122'        # total cash-out / outward volume
        self.inward_tx_count_col = 'F2582' # count of inward transactions
        self.outward_tx_count_col = 'F2678'# count of outward transactions
        self.counterparty_col = 'F2956'    # distinct counterparties

    def _safe_ratio(self, numerator: pd.Series, denominator: pd.Series) -> pd.Series:
        """Ratio that returns 0 instead of inf/NaN when denominator is 0."""
        denom = denominator.replace(0, np.nan)
        ratio = numerator / denom
        return ratio.fillna(0.0)

    def add_pass_through_ratio(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Pass-Through Ratio: how much of the money that comes IN gets moved
        OUT (esp. as cash) almost immediately. Mule accounts act as
        pipes, not stores of value, so this ratio trends close to 1.0
        for mule accounts and much lower for normal customer accounts.
        """
        if self.inflow_col in df.columns and self.cash_out_col in df.columns:
            df['pass_through_ratio'] = self._safe_ratio(df[self.cash_out_col], df[self.inflow_col])
            df['pass_through_ratio'] = df['pass_through_ratio'].clip(0, 5)
        return df

    def add_inward_concentration(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Inward Concentration: ratio of inward transaction COUNT to total
        transaction count. A high value means funds are being centrally
        routed INTO the account from many sources without a matching
        pattern of the account being used for its own regular spending -
        a classic collection-point mule signature.
        """
        if self.inward_tx_count_col in df.columns and self.outward_tx_count_col in df.columns:
            total_tx = df[self.inward_tx_count_col] + df[self.outward_tx_count_col]
            df['inward_concentration'] = self._safe_ratio(df[self.inward_tx_count_col], total_tx)
        return df

    def add_sudden_activation(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Sudden Activation: flags accounts with very low counterparty
        history but disproportionately high cash-out volume - i.e.
        previously dormant accounts that suddenly light up.
        """
        if self.counterparty_col in df.columns and self.cash_out_col in df.columns:
            counterparty_norm = (df[self.counterparty_col] + 1)
            df['sudden_activation'] = self._safe_ratio(df[self.cash_out_col], counterparty_norm)
            df['sudden_activation'] = df['sudden_activation'].clip(
                lower=0, upper=df['sudden_activation'].quantile(0.99)
            )
        return df

    def add_narrow_network_flag(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Narrow Network Flag: accounts operating with very few distinct
        counterparties relative to their transaction volume.
        """
        if self.counterparty_col in df.columns:
            threshold = df[self.counterparty_col].quantile(0.10)
            df['narrow_network_flag'] = (df[self.counterparty_col] <= threshold).astype(int)
        return df

    def engineer_features(self, df: pd.DataFrame, is_training: bool = True) -> pd.DataFrame:
        print("Engineering features...")
        df_features = df.copy()

        target = None
        if 'F3924' in df_features.columns:
            target = df_features['F3924']
            df_features = df_features.drop(columns=['F3924'])

        # --- Behavioral DNA feature construction ---
        df_features = self.add_pass_through_ratio(df_features)
        df_features = self.add_inward_concentration(df_features)
        df_features = self.add_sudden_activation(df_features)
        df_features = self.add_narrow_network_flag(df_features)

        # Interaction term between cash activity and narrow network,
        # per the "Cash-Network Interaction" feature in the design doc.
        if 'pass_through_ratio' in df_features.columns and 'narrow_network_flag' in df_features.columns:
            df_features['cash_network_interaction'] = (
                df_features['pass_through_ratio'] * df_features['narrow_network_flag']
            )

        self._is_fitted = True

        if target is not None:
            df_features['F3924'] = target.values

        return df_features