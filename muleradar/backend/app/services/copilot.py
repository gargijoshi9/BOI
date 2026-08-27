import os
import re
import requests
import sys
from pathlib import Path
from typing import Dict, Any, List
from dotenv import load_dotenv

# Automatically locate and load .env file from project root or backend dir
env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
if not env_path.exists():
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

_ML_PIPELINE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "ml_pipeline"
if not _ML_PIPELINE_DIR.exists():
    _ML_PIPELINE_DIR = Path(__file__).resolve().parent.parent.parent / "ml_pipeline"
_EXPLAINABILITY_DIR = _ML_PIPELINE_DIR / "src" / "explainability"
if str(_EXPLAINABILITY_DIR) not in sys.path:
    sys.path.insert(0, str(_EXPLAINABILITY_DIR))

try:
    from feature_dictionary import translate_feature
except ImportError:
    def translate_feature(f):
        return {"code": f, "variable_name": f, "description": "Not found in data dictionary"}

FEATURE_DISPLAY_NAMES: Dict[str, str] = {
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
    "sudden_activation_score": "Reactivation After Dormancy",
    "narrow_network_flag": "Limited Counterparty Network",
    "narrow_network_interaction": "High Cash / Low Counterparty",
    "cash_network_interaction": "High Cash / Low Counterparty",
    "dormancy_flag": "Prior Account Dormancy",
    "account_freshness_flag": "New Account (< 31 Days)",
    "high_cash_ratio": "High Cash Withdrawal Share",
    "CASH_TO_UPI_RATIO": "Cash to UPI Transfer Ratio",
    "ELEC_TO_CASH_RATIO": "E-Transfer to Cash Ratio",
    "VELOCITY_PROXY": "Transaction Velocity Score",
}

def _format_feature(item: Any) -> str:
    if isinstance(item, str):
        feat_code = item
        item_dict = {}
    elif isinstance(item, dict):
        feat_code = item.get("feature", "")
        item_dict = item
    else:
        return "Unknown Indicator"

    desc = item_dict.get("description")
    if desc and desc != "Not found in data dictionary" and not re.match(r"^F\d+$", desc.strip()):
        return re.sub(r"^F\d+\s*[-:]\s*", "", desc)

    is_missing = False
    clean_code = feat_code
    if clean_code.endswith("_was_missing"):
        is_missing = True
        clean_code = clean_code[:-12]

    if clean_code in FEATURE_DISPLAY_NAMES:
        name = FEATURE_DISPLAY_NAMES[clean_code]
        return f"{name} (Missing Indicator)" if is_missing else name

    translated = translate_feature(clean_code)
    t_desc = translated.get("description", "")
    t_var = translated.get("variable_name", "")

    if t_desc and t_desc != "Not found in data dictionary":
        clean_desc = re.sub(r"^F\d+\s*[-:]\s*", "", t_desc)
        return f"{clean_desc} (Missing Indicator)" if is_missing else clean_desc

    if t_var and t_var != clean_code and not re.match(r"^F\d+$", t_var):
        clean_var = t_var.replace("_", " ")
        return f"{clean_var} (Missing Indicator)" if is_missing else clean_var

    display_name = item_dict.get("display_name")
    if display_name and not re.match(r"^F\d+$", display_name):
        return f"{display_name} (Missing Indicator)" if is_missing else display_name

    clean_fallback = re.sub(r"^F\d+_*", "", clean_code).replace("_", " ").strip()
    if not clean_fallback:
        clean_fallback = "Behavioral Risk Feature"
    return f"{clean_fallback} (Missing Indicator)" if is_missing else clean_fallback

def generate_ai_explanation(report: Dict[str, Any]) -> str:
    """
    Generates a structured 4-bullet GenAI AML investigation summary.
    Translates raw SHAP feature codes into clear human-readable descriptions.
    """
    account_id = str(report.get("account_id", "Unknown"))
    risk_score = report.get("risk_score", 0)
    risk_level = report.get("risk_level", "Low")
    
    damage = report.get("damage_metrics", {})
    recoverable = damage.get("recoverable_amount", 0)
    in_transit = damage.get("in_transit_amount", 0)
    total_exposure = recoverable + in_transit
    
    nodes_list = report.get("network_connections", {}).get("nodes") or []
    nodes_count = len(nodes_list)
    edges_list = report.get("network_connections", {}).get("links") or report.get("network_connections", {}).get("edges") or []
    edges_count = len(edges_list)
    
    shap_items = report.get("shap_explanation", [])[:4]
    shap_str_list = [f"{_format_feature(item)} ({item['contribution']:+.3f})" if isinstance(item, dict) and 'contribution' in item else _format_feature(item) for item in shap_items]
    shap_summary = ", ".join(shap_str_list) if shap_str_list else "High pass-through ratio & narrow counterparty network"

    if risk_score >= 600:
        recommended_action = "Execute immediate Auto-Freeze on account under PMLA 2002 Section 17 and draft FIU-IND Suspicious Transaction Report (STR)."
    elif risk_score >= 300:
        recommended_action = "Flag for Human Review Queue, audit counterparty transactions, and request mandatory Re-KYC / Occupation proof."
    elif risk_score >= 150:
        recommended_action = "Request Document & KYC Verification for high-value UPI/cash spikes; maintain heightened monitoring."
    else:
        recommended_action = "Cleared. Maintain standard automated transaction monitoring."

    raw_key = os.getenv("OPENAI_API_KEY", "").strip(" \"'")
    
    if raw_key and raw_key != "your_openai_api_key_here":
        try:
            prompt = (
                f"You are a Senior Anti-Money Laundering (AML) Officer for Bank of India. Analyze the following suspicious account metrics and generate a concise 4-bullet compliance investigation summary for account {account_id}.\n\n"
                f"Account Data:\n"
                f"- Risk Score: {risk_score}/1000 ({risk_level} Risk Tier)\n"
                f"- Fraud Exposure: INR {total_exposure:,.0f} (Recoverable: INR {recoverable:,.0f}, In-Transit: INR {in_transit:,.0f})\n"
                f"- Counterparty Network: {nodes_count} connected counterparties across {edges_count} transfers\n"
                f"- Key SHAP Risk Drivers: {shap_summary}\n\n"
                f"STRICT OUTPUT FORMAT:\n"
                f"Output EXACTLY 4 bullet points starting with '• ' using these headings:\n"
                f"• Risk Score & Assessment: Evaluate the overall risk score and risk tier.\n"
                f"• Key Behavioral Drivers: Explain the significance of the top SHAP risk drivers.\n"
                f"• Network & Financial Exposure: Assess the financial risk and counterparty exposure.\n"
                f"• Actionable Next Step: Provide concrete, compliance-driven next steps (such as Auto-Freeze under PMLA Section 17, filing STR to FIU-IND, Re-KYC, or standard monitoring depending on severity).\n\n"
                f"Do not add any intro, outro, or additional text."
            )

            if raw_key.startswith("sk-or-"):
                headers = {
                    "Authorization": f"Bearer {raw_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://muleradar.com",
                    "X-Title": "MuleRadar AML Platform"
                }
                payload = {
                    "model": "openai/gpt-3.5-turbo",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 280,
                    "temperature": 0.0
                }
                res = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=8)
                if res.status_code == 200:
                    data = res.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    if content:
                        return content
            else:
                import openai
                client = openai.OpenAI(api_key=raw_key)
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=280,
                    temperature=0.0
                )
                content = response.choices[0].message.content.strip()
                if content:
                    return content
        except Exception as err:
            print(f"GenAI LLM API call warning: {err}. Using deterministic AML synthesis.")

    # 100% Deterministic Fallback
    b1 = f"• Risk Score & Assessment: Account {account_id} scored {risk_score}/1000 ({risk_level} Risk Tier)."
    b2 = f"• Key Behavioral Drivers: SHAP feature attributions: {shap_summary}."
    b3 = f"• Network & Financial Exposure: {nodes_count} connected counterparties with ₹{total_exposure:,.0f} total exposure."
    b4 = f"• Actionable Next Step: {recommended_action}"

    return f"{b1}\n{b2}\n{b3}\n{b4}"
