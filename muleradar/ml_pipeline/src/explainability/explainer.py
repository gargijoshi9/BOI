"""
AI Explainability - SHAP Values
Calculates SHAP values and maps them to top contributing features.
"""

from typing import Any, List, Union
import numpy as np
import pandas as pd
import shap


class FraudExplainer:
    """Explains machine learning model predictions for fraudulent transaction detection using SHAP."""

    def __init__(self, model: Any) -> None:
        """Initializes the FraudExplainer with a trained model.

        Args:
            model: A trained machine learning model (e.g., XGBoost, LightGBM).
        """
        self.model = model

    def explain_prediction(self, df_features: pd.DataFrame) -> Union[np.ndarray, list]:
        """Generates SHAP values for the input feature DataFrame.

        Args:
            df_features: A pandas DataFrame containing transaction features.

        Returns:
            np.ndarray or list: Computed SHAP values.
        """
        explainer = shap.TreeExplainer(self.model)
        return explainer.shap_values(df_features)

    def get_top_contributors(
        self, shap_values: Any, feature_names: List[str]
    ) -> List[dict]:
        """Maps SHAP values to feature names and returns the top 3 contributing factors with their impact.

        Args:
            shap_values: SHAP values returned from explain_prediction.
                         Can be a 1D/2D array or a list of arrays.
            feature_names: List of feature names corresponding to the columns.

        Returns:
            List[dict]: Formatted list of top 3 features and their impact (e.g., [{"feature": "pass_through_ratio", "impact": "+15%"}]).
        """
        # Resolve SHAP values format
        if isinstance(shap_values, list):
            if len(shap_values) > 1:
                vals = shap_values[1]
            else:
                vals = shap_values[0]
        else:
            vals = shap_values

        if len(vals.shape) > 1:
            row_values = vals[0]
        else:
            row_values = vals

        # Combine with feature names
        contributions = list(zip(feature_names, row_values))

        # Sort by absolute contribution descending (highest absolute impact first)
        contributions.sort(key=lambda x: abs(x[1]), reverse=True)

        # Get top 3 features
        top_features = contributions[:3]

        result = []
        for feat, val in top_features:
            impact_pct = int(round(val * 100))
            impact_str = f"{impact_pct:+}%" if impact_pct != 0 else "0%"
            result.append({
                "feature": feat,
                "impact": impact_str
            })

        return result


if __name__ == "__main__":
    # Self-test block with a mock model
    print("Testing FraudExplainer...")
    import xgboost as xgb

    # Create dummy dataset and train a simple model
    X = pd.DataFrame(
        {
            "pass_through_ratio": [0.1, 0.9, 0.8],
            "sudden_activation": [0.0, 1.5, 2.0],
            "narrow_network_flag": [0, 1, 1],
        }
    )
    y = np.array([0, 1, 1])

    # Simple XGBoost training
    model = xgb.XGBClassifier(n_estimators=3, max_depth=2, random_state=42)
    model.fit(X, y)

    explainer = FraudExplainer(model)
    shap_vals = explainer.explain_prediction(X.iloc[[1]])  # explain second row
    factors = explainer.get_top_contributors(shap_vals, list(X.columns))

    print("Generated SHAP values:", shap_vals)
    print("Top 3 contributors:", factors)
