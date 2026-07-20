import os
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()


class AIInvestigator:
    """
    Async AI Copilot Service for Anti-Money Laundering (AML) investigation summaries.
    Uses OpenAI AsyncOpenAI client with safe fallback handling when API key is missing.
    """

    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        
        # Safe fallback check for missing or dummy API key
        if not api_key or api_key.strip().lower() in ["", "dummy", "test", "your_openai_api_key", "sk-dummy"] or api_key.startswith("your_"):
            self.client = None
        else:
            self.client = AsyncOpenAI(api_key=api_key)

    async def generate_summary(self, intelligence_data: dict) -> str:
        """
        Generates a 3-sentence summary of the flagged account based on intelligence report data.
        If client is None, returns a safe mock string.
        """
        account_id = intelligence_data.get("account_id", "Unknown")
        risk_score = intelligence_data.get("risk_score", 0)
        risk_level = intelligence_data.get("risk_level", "Unknown")
        kill_chain_stage = intelligence_data.get("kill_chain_stage", "None")
        shap_explanation = intelligence_data.get("shap_explanation", [])

        # Fallback when OpenAI API key is missing or invalid
        if self.client is None:
            return (
                f"Account {account_id} is flagged with a {risk_level} risk level (Risk Score: {risk_score}/1000). "
                f"The account is currently classified in the '{kill_chain_stage}' stage of the money laundering kill chain. "
                f"Automated SHAP indicators highlight critical anomalous transaction frequencies and velocity patterns requiring immediate AML compliance review."
            )

        try:
            prompt = (
                f"You are an expert Anti-Money Laundering (AML) investigator at Bank of India. "
                f"Provide a concise, professional 3-sentence summary of the flagged account based on the following risk intelligence:\n\n"
                f"- Account ID: {account_id}\n"
                f"- Risk Score: {risk_score}/1000 ({risk_level} Risk)\n"
                f"- Kill Chain Stage: {kill_chain_stage}\n"
                f"- Behavioral SHAP Feature Attribution: {shap_explanation}\n\n"
                f"Highlight the critical risk factors, kill chain placement, and recommended immediate action for compliance."
            )

            response = await self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an AI Anti-Money Laundering (AML) Investigator assistant for Bank of India Fraud Operations."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=200
            )

            return response.choices[0].message.content.strip()

        except Exception as e:
            # Fallback error handling if API call fails
            return (
                f"Account {account_id} is flagged with a {risk_level} risk level (Risk Score: {risk_score}/1000). "
                f"The account is currently classified in the '{kill_chain_stage}' stage of the money laundering kill chain. "
                f"(GenAI Summary fallback due to API status: {str(e)})"
            )
