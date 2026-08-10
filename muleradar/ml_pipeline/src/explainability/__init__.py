"""
Explainability package: SHAP value computation, feature attributions, and GenAI copilot summary report generation.
"""

from .shap_explainer import (
    AccountExplanation,
    FeatureContribution,
    ShapExplainerService,
    to_waterfall_json,
)
from .report_generator import GenAIReportGenerator

__all__ = [
    "ShapExplainerService",
    "AccountExplanation",
    "FeatureContribution",
    "to_waterfall_json",
    "GenAIReportGenerator",
]
