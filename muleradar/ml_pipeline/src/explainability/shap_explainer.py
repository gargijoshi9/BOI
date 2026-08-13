"""
shap_explainer.py
------------------
Bank-grade explainability layer for MuleRadar's ensemble risk model.

Why this exists as its own module (not three lines inside analyzer.py):
A regulator or investigator doesn't just want "here are 5 numbers." They want:
  1. Explanations that are mathematically verified (additivity check),
  2. Explanations in business language, not feature codes like F3043,
  3. Context — "top 2% of all accounts" means more than "value = 0.94",
  4. A consistent, auditable output shape the frontend and the Copilot
     can both consume without re-deriving anything.

This module owns all of that. analyzer.py should just call
ShapExplainerService.explain_account(...) and use the result.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd
import shap

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. Business-friendly feature naming
# ---------------------------------------------------------------------------
# Raw feature codes (F3043, F670, ...) mean nothing to an investigator or a
# judge. Map every feature you actually use in the final 50-feature set here.
# Anything not in this dict falls back to a cleaned-up version of its raw name.

FEATURE_DISPLAY_NAMES: dict[str, str] = {
    "F115": "Cheque Usage Ratio",
    "F321": "Recent Cheque Amount Ratio",
    "F527": "Cheque Credit Ratio",
    "F531": "Cheque Debit Ratio",
    "F670": "Weekly Min UPI Transfers",
    "F1692": "14-Day Cash Withdrawals",
    "F2082": "Net-Banking Debit Frequency",
    "F2122": "Monthly Cash Activity",
    "F2582": "Unusual UPI Credit Surge",
    "F2678": "E-Transfer Volume Surge",
    "F2737": "Cheque Value Anomaly",
    "F2956": "Cheque Deposit Surge",
    "F3043": "Cash Volume Deviation",
    "F3800": "Total 31-Day Inflow",
    "F3801": "Total 31-Day Outflow",
    "F3836": "14-Day Average Balance",
    "F3887": "Account Tenure at Alert",
    "F3889": "Account Age (Days Open)",
    "F3891": "Customer Occupation Category",
    "F3894": "Customer Age",
    "F3924": "Mule Target Status",
    "pass_through_ratio": "Rapid Cash Pass-Through",
    "inward_concentration": "Inbound Transfer Concentration",
    "inward_concentration_ratio": "Inbound Transfer Concentration",
    "sudden_activation": "Reactivation After Dormancy",
    "narrow_network_flag": "Limited Counterparty Network",
    "cash_network_interaction": "High Cash / Low Counterparty",
    "dormancy_flag": "Prior Account Dormancy",
    "account_freshness_flag": "New Account (< 31 Days)",
    "high_cash_ratio": "High Cash Withdrawal Share",
    "CASH_TO_UPI_RATIO": "Cash to UPI Transfer Ratio",
    "ELEC_TO_CASH_RATIO": "E-Transfer to Cash Ratio",
    "VELOCITY_PROXY": "Transaction Velocity Score",
}

# Human-readable direction phrasing per feature, used when generating the
# narrative sentence. Positive SHAP = pushes risk up. Negative = pushes it down.
DIRECTION_PHRASING: dict[str, tuple[str, str]] = {
    "pass_through_ratio": ("elevated cash pass-through", "typical cash retention"),
    "inward_concentration_ratio": ("concentrated inbound funding", "diversified inbound funding"),
    "sudden_activation": ("a sudden activation after dormancy", "steady, expected activity"),
    "narrow_network_flag": ("an unusually narrow counterparty network", "a broad counterparty network"),
    "dormancy_flag": ("a period of dormancy before reactivation", "continuous account activity"),
    "account_freshness_flag": ("recent account opening", "an established account history"),
    "F3800": ("high credit transaction volume", "typical credit volume"),
    "F3801": ("high debit cash outflow", "typical debit volume"),
    "F2582": ("unusual UPI credit amount deviation", "stable UPI transaction patterns"),
    "F670": ("anomalously low UPI transaction count", "normal UPI transfer count"),
    "F1692": ("elevated cash debit transaction count", "typical cash debit count"),
    "F3043": ("high cash transaction total deviation", "expected cash transaction volume"),
    "F3894": ("vulnerable/at-risk customer age bracket", "typical customer age demographic"),
}

DEFAULT_DIRECTION_PHRASING = ("an elevated value", "a lower-than-typical value")


def _display_name(feature: str) -> str:
    if feature in FEATURE_DISPLAY_NAMES:
        return FEATURE_DISPLAY_NAMES[feature]
    if feature.endswith("_was_missing"):
        base_feat = feature[:-12]
        base_desc = FEATURE_DISPLAY_NAMES.get(base_feat, base_feat.replace("_", " ").capitalize())
        return f"Missing {base_desc}"
    if feature.startswith("F3891_is_"):
        occ_type = feature[9:].capitalize()
        return f"Occupation: {occ_type}"
    # Strip raw feature codes like F1057 or F1597 if unmapped
    import re
    clean_name = re.sub(r"^F\d+_", "", feature)
    clean_name = re.sub(r"^F\d+$", "", clean_name)
    if not clean_name:
        clean_name = feature
    return clean_name.replace("_", " ").title()


# ---------------------------------------------------------------------------
# 2. Structured output contract
# ---------------------------------------------------------------------------
# Everything downstream (React SHAP bar chart, Copilot prompt builder, PDF
# investigation report) should consume THIS shape, not raw shap.Explanation
# objects. This is the "audit-ready" contract.

@dataclass
class FeatureContribution:
    feature: str
    display_name: str
    shap_value: float          # signed contribution to the log-odds / score
    feature_value: float       # the account's actual value for this feature
    population_percentile: float  # where this account sits vs all accounts (0-100)
    direction: str              # "increases_risk" | "decreases_risk"
    narrative_fragment: str     # human sentence fragment, ready to slot into a report


@dataclass
class AccountExplanation:
    account_id: str
    base_value: float               # model's expected output before any features
    predicted_score: float          # final risk score after all contributions
    reconstructed_score: float      # base_value + sum(shap_values), for the additivity check
    additivity_check_passed: bool   # True if reconstructed_score ~= predicted_score
    top_contributions: list[FeatureContribution]
    narrative_summary: str          # 2-3 sentence plain-English explanation
    model_source: str = "xgb_lgbm_weighted_ensemble"


# ---------------------------------------------------------------------------
# 3. Core service
# ---------------------------------------------------------------------------

class ShapExplainerService:
    """
    Wraps SHAP TreeExplainers for both XGBoost and LightGBM members of the
    ensemble, combines their attributions using the SAME weights the ensemble
    uses for its final score, and produces audit-ready explanations.

    Usage:
        service = ShapExplainerService(
            xgb_model=ensemble.xgb_model,
            lgbm_model=ensemble.lgbm_model,
            xgb_weight=0.40,
            lgbm_weight=0.30,
            background_df=training_features_df,   # for population percentiles
        )
        explanation = service.explain_account(account_id, account_row)
    """

    def __init__(
        self,
        xgb_model,
        lgbm_model,
        xgb_weight: float,
        lgbm_weight: float,
        background_df: pd.DataFrame,
        top_n: int = 5,
    ):
        self.xgb_model = xgb_model
        self.lgbm_model = lgbm_model
        self.xgb_weight = xgb_weight
        self.lgbm_weight = lgbm_weight
        self.top_n = top_n

        # Population reference for percentile context ("top 2% of accounts")
        self.background_df = background_df

        # TreeExplainer is fast and exact for tree ensembles — no KernelSHAP
        # approximation needed, which matters for both speed and for the
        # "mathematically exact, not approximated" claim in the report.
        self._xgb_explainer = shap.TreeExplainer(self.xgb_model)
        self._lgbm_explainer = shap.TreeExplainer(self.lgbm_model)

        logger.info(
            "ShapExplainerService initialized (xgb_weight=%.2f, lgbm_weight=%.2f, "
            "background_n=%d)",
            xgb_weight, lgbm_weight, len(background_df),
        )

    # -- public API ----------------------------------------------------

    def explain_account(
        self, account_id: str, feature_row: pd.Series, predicted_score: float
    ) -> AccountExplanation:
        """
        Produces a full, audit-ready explanation for one account.
        predicted_score should be the SAME 0-1000 score already shown
        elsewhere in the UI, so the additivity check is meaningful.
        """
        feature_df = feature_row.to_frame().T

        xgb_values, xgb_base = self._get_shap_values(self._xgb_explainer, feature_df)
        lgbm_values, lgbm_base = self._get_shap_values(self._lgbm_explainer, feature_df)

        # Combine using the SAME weights the ensemble uses for its final score.
        # This is what makes the explanation faithful to the actual prediction,
        # rather than just explaining one sub-model in isolation.
        combined_values = (self.xgb_weight * xgb_values) + (self.lgbm_weight * lgbm_values)
        combined_base = (self.xgb_weight * xgb_base) + (self.lgbm_weight * lgbm_base)

        contributions = self._rank_contributions(feature_row, combined_values)

        reconstructed = float(combined_base + combined_values.sum())
        additivity_passed = self._check_additivity(reconstructed, predicted_score)

        narrative = self._build_narrative(contributions, predicted_score)

        return AccountExplanation(
            account_id=account_id,
            base_value=float(combined_base),
            predicted_score=predicted_score,
            reconstructed_score=reconstructed,
            additivity_check_passed=additivity_passed,
            top_contributions=contributions,
            narrative_summary=narrative,
        )

    def global_feature_importance(self, sample_df: pd.DataFrame) -> pd.DataFrame:
        """
        Mean |SHAP value| across a sample of accounts, for the
        'Model Performance' / global explainability page — separate from
        any single account's explanation.
        """
        xgb_values, _ = self._get_shap_values(self._xgb_explainer, sample_df)
        lgbm_values, _ = self._get_shap_values(self._lgbm_explainer, sample_df)

        combined = (self.xgb_weight * np.abs(xgb_values)) + (
            self.lgbm_weight * np.abs(lgbm_values)
        )
        mean_importance = combined.mean(axis=0)

        result = pd.DataFrame(
            {
                "feature": sample_df.columns,
                "display_name": [_display_name(c) for c in sample_df.columns],
                "mean_abs_shap": mean_importance,
            }
        ).sort_values("mean_abs_shap", ascending=False)

        return result.reset_index(drop=True)

    # -- internals -------------------------------------------------------

    def _get_shap_values(self, explainer: shap.TreeExplainer, df: pd.DataFrame):
        raw = explainer.shap_values(df)
        # Binary classifiers sometimes return a list [class0, class1]; we want
        # the positive (mule) class contributions.
        if isinstance(raw, list):
            values = np.array(raw[1])
            base = explainer.expected_value[1] if isinstance(
                explainer.expected_value, (list, np.ndarray)
            ) else explainer.expected_value
        else:
            values = np.array(raw)
            base = explainer.expected_value
        if len(df) == 1 and len(values.shape) > 1:
            return values[0], float(base)
        return values, float(base if np.isscalar(base) else base[0])

    def _rank_contributions(
        self, feature_row: pd.Series, shap_values: np.ndarray
    ) -> list[FeatureContribution]:
        pairs = list(zip(feature_row.index, shap_values))
        pairs.sort(key=lambda p: abs(p[1]), reverse=True)
        top = pairs[: self.top_n]

        contributions = []
        for feature, value in top:
            feature_value = float(feature_row[feature])
            percentile = self._population_percentile(feature, feature_value)
            direction = "increases_risk" if value > 0 else "decreases_risk"
            up_phrase, down_phrase = DIRECTION_PHRASING.get(
                feature, DEFAULT_DIRECTION_PHRASING
            )
            fragment = up_phrase if direction == "increases_risk" else down_phrase

            contributions.append(
                FeatureContribution(
                    feature=feature,
                    display_name=_display_name(feature),
                    shap_value=round(float(value), 4),
                    feature_value=feature_value,
                    population_percentile=percentile,
                    direction=direction,
                    narrative_fragment=fragment,
                )
            )
        return contributions

    def _population_percentile(self, feature: str, value: float) -> float:
        """Where does this account's value sit vs. the training population?"""
        if feature not in self.background_df.columns:
            return -1.0
        column = self.background_df[feature].dropna()
        if len(column) == 0:
            return -1.0
        percentile = (column < value).mean() * 100
        return round(float(percentile), 1)

    def _check_additivity(
        self, reconstructed_score: float, predicted_score: float, tolerance: float = 1e-2
    ) -> bool:
        """
        SHAP's core guarantee: base_value + sum(shap_values) == model output.
        We verify this and surface it, because 'we checked the math' is a real
        trust signal for a regulator, not just a nice-to-have.
        Note: reconstructed_score is in the ensemble's raw probability space;
        scale it consistently before comparing if predicted_score is 0-1000.
        """
        # If predicted_score is on the 0-1000 scale, normalize before compare
        normalized_predicted = predicted_score / 1000.0 if predicted_score > 1 else predicted_score
        return abs(reconstructed_score - normalized_predicted) <= tolerance

    def _build_narrative(
        self, contributions: list[FeatureContribution], predicted_score: float
    ) -> str:
        if not contributions:
            return "No significant contributing factors were identified for this account."

        risky = [c for c in contributions if c.direction == "increases_risk"]
        protective = [c for c in contributions if c.direction == "decreases_risk"]

        parts = []
        if risky:
            top_risky = risky[:3]
            fragments = ", ".join(c.narrative_fragment for c in top_risky[:-1])
            if len(top_risky) > 1:
                fragments += f", and {top_risky[-1].narrative_fragment}"
            else:
                fragments = top_risky[0].narrative_fragment
            parts.append(
                f"This account's risk score of {predicted_score:.0f} was primarily driven by "
                f"{fragments}."
            )
        if protective:
            top_protective = protective[0]
            parts.append(
                f"This was partially offset by {top_protective.narrative_fragment} "
                f"in {top_protective.display_name.lower()}."
            )

        return " ".join(parts)


# ---------------------------------------------------------------------------
# 4. Frontend-ready serialization
# ---------------------------------------------------------------------------

def to_waterfall_json(explanation: AccountExplanation) -> dict[str, Any]:
    """
    Shapes the explanation for the React SHAP bar/waterfall chart component.
    Keep this function as the single source of truth for the API response
    shape so the frontend never has to reach into raw SHAP objects.
    """
    return {
        "account_id": explanation.account_id,
        "base_value": explanation.base_value,
        "predicted_score": explanation.predicted_score,
        "additivity_check_passed": explanation.additivity_check_passed,
        "narrative_summary": explanation.narrative_summary,
        "contributions": [
            {
                "feature": c.display_name,
                "shap_value": c.shap_value,
                "feature_value": c.feature_value,
                "population_percentile": c.population_percentile,
                "direction": c.direction,
            }
            for c in explanation.top_contributions
        ],
    }
