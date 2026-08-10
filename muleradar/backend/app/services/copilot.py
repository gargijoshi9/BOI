import logging
from typing import Any
from pathlib import Path
import sys

# Ensure muleradar / ml_pipeline root is on sys.path for importing explainability
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

try:
    from ml_pipeline.src.explainability.report_generator import GenAIReportGenerator
except ImportError:
    try:
        from src.explainability.report_generator import GenAIReportGenerator
    except ImportError:
        from explainability.report_generator import GenAIReportGenerator

logger = logging.getLogger(__name__)


class AIInvestigator:
    """
    Async AI Copilot Service for Anti-Money Laundering (AML) investigation summaries.
    Delegates summary generation to the explainability module's GenAIReportGenerator.
    """

    def __init__(self):
        self._generator = GenAIReportGenerator()

    async def generate_summary(self, intelligence_data: dict[str, Any]) -> str:
        """
        Generates a 3-sentence summary of the flagged account based on intelligence report data.
        """
        return await self._generator.generate_async_summary(intelligence_data)
