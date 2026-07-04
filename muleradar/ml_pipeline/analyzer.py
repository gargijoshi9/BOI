import random

class MuleRiskAnalyzer:
    def __init__(self):
        # Future integration point for XGBoost/LightGBM models
        self.engine_status = "Dynamic Simulator Active"
        
    def calculate_pass_through(self, account_id: str) -> float:
        """Simulates calculating how much money goes in vs immediately out."""
        base_val = sum(ord(char) for char in account_id) % 100
        return round(base_val / 100.0, 2)

    def evaluate_account(self, account_id: str) -> dict:
        """Generates dynamic risk metrics based on the Account ID."""
        pass_through_ratio = self.calculate_pass_through(account_id)
        
        # Dynamic Risk Score (Simulating XGBoost output)
        base_risk = 300 + (pass_through_ratio * 600) 
        risk_score = int(min(base_risk + random.randint(-50, 50), 1000))
        
        # Determine Risk Level and Kill Chain Stage
        if risk_score > 800:
            level = "Critical"
            stage = "Layering"
        elif risk_score > 600:
            level = "High"
            stage = "Placement"
        elif risk_score > 400:
            level = "Medium"
            stage = "Integration"
        else:
            level = "Low"
            stage = "None"

        # Generate dynamic mock financial data
        recoverable = round(risk_score * 1250.50, 2)
        in_transit = round(risk_score * 340.25, 2)

        # Return the assembled intelligence matching the API contract
        return {
            "account_id": account_id,
            "risk_score": risk_score,
            "risk_level": level,
            "kill_chain_stage": stage,
            "damage_metrics": {
                "recoverable_amount": recoverable,
                "in_transit_amount": in_transit
            },
            "shap_explanation": [
                {"feature": "pass_through_ratio", "contribution": pass_through_ratio},
                {"feature": "sudden_activation", "contribution": round(random.uniform(0.1, 0.4), 2)},
                {"feature": "narrow_network", "contribution": round(random.uniform(0.05, 0.2), 2)}
            ],
            "network_connections": {
                "nodes": [
                    {"id": account_id, "type": "mule"}, 
                    {"id": f"BOI-{random.randint(10000, 99999)}", "type": "cash_out"}
                ],
                "edges": [
                    {"source": account_id, "target": f"BOI-{random.randint(10000, 99999)}", "amount": round(in_transit * 0.8, 2)}
                ]
            }
        }