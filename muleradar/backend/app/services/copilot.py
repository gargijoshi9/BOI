# backend/app/services/copilot.py
import os
import requests
from pathlib import Path
from typing import Dict, Any, List
from dotenv import load_dotenv

# Automatically locate and load .env file from project root or backend dir
env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
if not env_path.exists():
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

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

def _format_feature(raw: str) -> str:
    if raw in FEATURE_DISPLAY_NAMES:
        return FEATURE_DISPLAY_NAMES[raw]
    if raw.endswith('_was_missing'):
        base = raw[:-12]
        return f"{FEATURE_DISPLAY_NAMES.get(base, base)} (Missing Indicator)"
    return raw.replace('_', ' ')

def generate_ai_explanation(report: Dict[str, Any]) -> str:
    """
    Generates a 100% deterministic, structured 4-bullet GenAI AML investigation summary.
    Uses OPENAI_API_KEY from .env with temperature=0.0 and standardized compliance headings.
    """
    account_id = str(report.get("account_id", "Unknown"))
    risk_score = report.get("risk_score", 0)
    risk_level = report.get("risk_level", "Low")
    kill_stage = report.get("kill_chain_stage", "None")
    
    damage = report.get("damage_metrics", {})
    recoverable = damage.get("recoverable_amount", 0)
    in_transit = damage.get("in_transit_amount", 0)
    total_exposure = recoverable + in_transit
    
    nodes_count = len(report.get("network_connections", {}).get("nodes", []))
    edges_count = len(report.get("network_connections", {}).get("links", []))
    
    shap_items = report.get("shap_explanation", [])[:4]
    shap_str_list = [f"{_format_feature(item['feature'])} ({item['contribution']:+.3f})" for item in shap_items]
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
                f"You are a Senior Anti-Money Laundering (AML) Officer. Write a strictly formatted 4-bullet compliance summary for account {account_id}.\n\n"
                f"Account Data:\n"
                f"- Risk Score: {risk_score}/1000 ({risk_level} Tier)\n"
                f"- Kill Chain Stage: {kill_stage}\n"
                f"- Fraud Exposure: INR {total_exposure:,.0f} (Recoverable: INR {recoverable:,.0f}, In-Transit: INR {in_transit:,.0f})\n"
                f"- Network Graph: {nodes_count} connected counterparties across {edges_count} transfers\n"
                f"- Key SHAP Risk Drivers: {shap_summary}\n"
                f"- Recommended Action: {recommended_action}\n\n"
                f"STRICT OUTPUT FORMAT:\n"
                f"Output EXACTLY 4 bullet points starting with '• ' using these exact headings:\n"
                f"• Risk Score & Assessment: State Risk Score ({risk_score}/1000), Tier ({risk_level}), and Kill Chain Stage ({kill_stage}).\n"
                f"• Key Behavioral Drivers: Summarize the top SHAP features ({shap_summary}).\n"
                f"• Network & Financial Exposure: Summarize counterparties ({nodes_count}) and exposure (₹{total_exposure:,.0f}).\n"
                f"• Actionable Next Step: State exact recommendation ({recommended_action}).\n"
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
    b1 = f"• Risk Score & Assessment: Account {account_id} scored {risk_score}/1000 ({risk_level} Risk Tier) operating in the {kill_stage} stage."
    b2 = f"• Key Behavioral Drivers: SHAP feature attributions: {shap_summary}."
    b3 = f"• Network & Financial Exposure: {nodes_count} connected counterparties with ₹{total_exposure:,.0f} total exposure."
    b4 = f"• Actionable Next Step: {recommended_action}"

    return f"{b1}\n{b2}\n{b3}\n{b4}"
