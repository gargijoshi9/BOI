"""
report_generator.py
--------------------
GenAI Copilot Summary & AML Investigation Report Generator for MuleRadar.

Extends mathematical SHAP explanations with LLM-generated executive summaries
and regulatory investigation reports.

This module fulfills the explainability layer contract:
1. Consumes structured AccountExplanation objects or intelligence dicts.
2. Formats precise AML context (risk score, kill chain stage, top SHAP drivers, additivity status).
3. Queries OpenAI/OpenRouter for natural language investigator summaries.
4. Provides deterministic fallback summaries when API keys are absent or offline.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Optional
from dotenv import load_dotenv

try:
    from openai import AsyncOpenAI, OpenAI
    _OPENAI_AVAILABLE = True
except ImportError:
    _OPENAI_AVAILABLE = False

from .shap_explainer import AccountExplanation

logger = logging.getLogger(__name__)

# Resolve root .env file if available
_BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
_DOTENV_PATH = _BASE_DIR / ".env"
if _DOTENV_PATH.exists():
    load_dotenv(dotenv_path=_DOTENV_PATH)


class GenAIReportGenerator:
    """
    Generates AI-powered AML compliance summaries and investigation reports
    by contextualizing model predictions, SHAP feature attributions, and graph metrics.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ):
        api_key = api_key or os.getenv("OPENAI_API_KEY")
        base_url = base_url or os.getenv("OPENAI_BASE_URL")
        model = model or os.getenv("OPENAI_MODEL")

        if api_key and api_key.startswith("sk-or-v1-"):
            if not base_url:
                base_url = "https://openrouter.ai/api/v1"
            if not model:
                model = "openai/gpt-3.5-turbo"

        self.model = model or "gpt-3.5-turbo"

        # Check for placeholder or missing API key
        if (
            not _OPENAI_AVAILABLE
            or not api_key
            or api_key.strip().lower() in ["", "dummy", "test", "your_openai_api_key", "sk-dummy"]
            or api_key.startswith("your_")
        ):
            self.async_client = None
            self.sync_client = None
        else:
            kwargs = {"api_key": api_key}
            if base_url:
                kwargs["base_url"] = base_url
            self.async_client = AsyncOpenAI(**kwargs)
            self.sync_client = OpenAI(**kwargs)

        logger.info(
            "GenAIReportGenerator initialized (model=%s, client_active=%s)",
            self.model,
            self.async_client is not None,
        )

    async def generate_async_summary(self, intelligence_data: dict[str, Any] | AccountExplanation) -> str:
        """
        Asynchronously generates a 3-sentence AML investigation summary.
        """
        payload = self._parse_intelligence_data(intelligence_data)

        if self.async_client is None:
            return self._build_fallback_summary(payload)

        try:
            prompt = self._build_prompt(payload)
            response = await self.async_client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an AI Anti-Money Laundering (AML) Investigator assistant "
                            "for Bank of India Fraud Operations. Synthesize clear, audit-ready summaries."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=250,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning("Async GenAI summary generation failed: %s", e)
            return self._build_fallback_summary(payload, error_note=str(e))

    def generate_sync_summary(self, intelligence_data: dict[str, Any] | AccountExplanation) -> str:
        """
        Synchronously generates a 3-sentence AML investigation summary.
        """
        payload = self._parse_intelligence_data(intelligence_data)

        if self.sync_client is None:
            return self._build_fallback_summary(payload)

        try:
            prompt = self._build_prompt(payload)
            response = self.sync_client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an AI Anti-Money Laundering (AML) Investigator assistant "
                            "for Bank of India Fraud Operations. Synthesize clear, audit-ready summaries."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=250,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning("Sync GenAI summary generation failed: %s", e)
            return self._build_fallback_summary(payload, error_note=str(e))

    def _parse_intelligence_data(self, intelligence_data: dict[str, Any] | AccountExplanation) -> dict[str, Any]:
        if isinstance(intelligence_data, AccountExplanation):
            return {
                "account_id": intelligence_data.account_id,
                "risk_score": intelligence_data.predicted_score,
                "risk_level": "Critical" if intelligence_data.predicted_score > 800 else "High" if intelligence_data.predicted_score > 600 else "Medium" if intelligence_data.predicted_score > 400 else "Low",
                "kill_chain_stage": "Layering" if intelligence_data.predicted_score > 800 else "Placement" if intelligence_data.predicted_score > 600 else "Integration" if intelligence_data.predicted_score > 400 else "None",
                "shap_explanation": [
                    {"feature": c.display_name, "contribution": c.shap_value, "direction": c.direction}
                    for c in intelligence_data.top_contributions
                ],
                "narrative_summary": intelligence_data.narrative_summary,
            }
        return intelligence_data

    def _build_prompt(self, payload: dict[str, Any]) -> str:
        account_id = payload.get("account_id", "Unknown")
        risk_score = payload.get("risk_score", 0)
        risk_level = payload.get("risk_level", "Unknown")
        kill_chain_stage = payload.get("kill_chain_stage", "None")
        shap_explanation = payload.get("shap_explanation", [])
        narrative = payload.get("narrative_summary", "")

        return (
            f"You are an expert Anti-Money Laundering (AML) investigator at Bank of India.\n"
            f"Provide a concise, professional 3-sentence summary of the flagged account based on the following risk intelligence:\n\n"
            f"- Account ID: {account_id}\n"
            f"- Risk Score: {risk_score}/1000 ({risk_level} Risk)\n"
            f"- Kill Chain Stage: {kill_chain_stage}\n"
            f"- SHAP Feature Drivers: {shap_explanation}\n"
            f"- Base Feature Narrative: {narrative}\n\n"
            f"Highlight the critical risk factors, kill chain placement, and recommended immediate action for compliance."
        )

    def _build_fallback_summary(self, payload: dict[str, Any], error_note: Optional[str] = None) -> str:
        account_id = payload.get("account_id", "Unknown")
        risk_score = payload.get("risk_score", 0)
        risk_level = payload.get("risk_level", "Unknown")
        kill_chain_stage = payload.get("kill_chain_stage", "None")
        narrative = payload.get("narrative_summary", "")

        base = (
            f"Account {account_id} is flagged with a {risk_level} risk level (Risk Score: {risk_score}/1000). "
            f"The account is currently classified in the '{kill_chain_stage}' stage of the money laundering kill chain. "
        )
        if narrative:
            base += f"{narrative} Immediate AML compliance review is recommended."
        else:
            base += (
                "Automated SHAP indicators highlight critical anomalous transaction frequencies and velocity patterns "
                "requiring immediate AML compliance review."
            )
        if error_note:
            base += f" (GenAI Summary fallback due to API status: {error_note})"
        return base
