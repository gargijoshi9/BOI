"""
MuleRiskAnalyzer - bridges the trained ML ensemble (mule_pipeline_v2.pkl) to the
FastAPI backend.
"""

import re
import sys
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

try:
    import shap
    _SHAP_AVAILABLE = True
except ImportError:
    _SHAP_AVAILABLE = False

_ML_PIPELINE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "ml_pipeline"
if not _ML_PIPELINE_DIR.exists():
    _ML_PIPELINE_DIR = Path(__file__).resolve().parent.parent.parent / "ml_pipeline"

_SRC_DIR = _ML_PIPELINE_DIR / "src"
_GRAPH_ENGINE_DIR = _SRC_DIR / "graph_engine"
for _p in (_SRC_DIR, _GRAPH_ENGINE_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

try:
    from graph_initializer import TransactionGraphInitializer
except ImportError:
    class TransactionGraphInitializer:
        def build_synthetic_account_neighborhood(self, **kwargs):
            return {}
        def compute_network_intelligence(self, graph, account_id):
            return {"nodes": [{"id": account_id, "type": "account"}], "edges": []}

BASE_DIR = _ML_PIPELINE_DIR
ARTIFACT_PATH = BASE_DIR / "saved_models" / "mule_pipeline_v2.pkl"
DATASET_PATH = BASE_DIR / "data" / "boi_dataset.csv"

_INFLOW_COL = 'F2082'
_CASH_OUT_COL = 'F2122'
_COUNTERPARTY_COL = 'F2678'
_ACCT_TYPE_COL = 'F3886'
_OCCUPATION_COL = 'F3891'
_AGE_COL = 'F3894'

class MuleRiskAnalyzer:
    def __init__(self):
        self.artifact = None
        self._dataset_cache: Optional[pd.DataFrame] = None
        self._shap_explainer = None
        self._graph_initializer = TransactionGraphInitializer()
        self.train_account_ids = set()

        if ARTIFACT_PATH.exists():
            self.artifact = joblib.load(ARTIFACT_PATH)

            self.final_features = self.artifact['final_features']
            self.final_cat_cols = self.artifact['final_cat_cols']
            self.numeric_cols = [c for c in self.final_features if c not in self.final_cat_cols]
            self.leaky_columns = self.artifact.get('leaky_columns', [])
            self.train_account_ids = set(str(a) for a in self.artifact.get('train_account_ids', []))

            self.imputer = self.artifact['imputer']
            self.xgb_model = self.artifact['xgb_model']
            self.lgbm_model = self.artifact['lgbm_model']
            self.cat_model = self.artifact['cat_model']
            self.iso_forest = self.artifact['iso_forest']
            self.meta_model = self.artifact['meta_model']
            self.use_stacking = self.artifact['use_stacking']
            
            self.optimal_threshold = self.artifact.get('optimal_threshold', 0.80)
            self.t_low = self.artifact.get('t_low', self.optimal_threshold * 0.70)
            self.t_high = self.artifact.get('t_high', min(self.optimal_threshold * 1.30, 0.95))

            self.engine_status = f"Live Ensemble Model Active ({'Stacked' if self.use_stacking else 'Blended'})"

            if _SHAP_AVAILABLE:
                try:
                    self._shap_explainer = shap.TreeExplainer(self.xgb_model)
                except Exception as e:
                    print(f"Warning: could not initialize SHAP explainer: {e}")
        else:
            self.engine_status = "Dynamic Simulator Active (trained model artifact not found)"

    def _load_dataset(self) -> Optional[pd.DataFrame]:
        if self._dataset_cache is not None:
            return self._dataset_cache
        if not DATASET_PATH.exists():
            return None
        df = pd.read_csv(DATASET_PATH)

        if 'account_id' not in df.columns and 'Unnamed: 0' in df.columns:
            df = df.rename(columns={'Unnamed: 0': 'account_id'})
            df['account_id'] = df['account_id'].astype(str)

        df.columns = [
            'account_id' if c == 'account_id' else re.sub(r'[\[\]{} ,:]', '_', c)
            for c in df.columns
        ]

        self._dataset_cache = df
        return self._dataset_cache

    def _get_account_row(self, account_id: str) -> Optional[pd.DataFrame]:
        df = self._load_dataset()
        if df is None or 'account_id' not in df.columns:
            return None
        row = df[df['account_id'] == str(account_id)]
        return None if row.empty else row

    def _bucket_risk(self, proba: float):
        t_opt = getattr(self, 'optimal_threshold', 0.80)
        t_high = getattr(self, 't_high', 0.95)
        t_low = getattr(self, 't_low', 0.40)

        critical_thresh = max(t_opt, t_high)
        high_thresh = min(t_opt, t_high)

        if proba >= critical_thresh:
            return "Critical", "Layering"
        elif proba >= high_thresh:
            return "High", "Placement"
        elif proba >= t_low:
            return "Medium", "Integration"
        return "Low", "None"

    def _route_hitl(self, proba: float, is_anomaly: bool) -> dict:
        t_high = getattr(self, 't_high', 0.95)
        t_low = getattr(self, 't_low', 0.40)
        
        if proba >= t_high:
            band, requires_review, reason = "AUTO_BLOCK", False, None
        elif proba < t_low:
            band, requires_review, reason = "AUTO_CLEAR", False, None
        else:
            band, requires_review, reason = "HUMAN_REVIEW", True, "borderline_confidence"

        if is_anomaly and band == "AUTO_CLEAR":
            band, requires_review, reason = "HUMAN_REVIEW", True, "anomaly_override"

        return {
            "requires_review": requires_review,
            "review_reason": reason,
            "confidence_band": band,
            "anomaly_flagged": is_anomaly,
        }

    def _prepare_model_input(self, raw_row: pd.DataFrame):
        model_input = raw_row.reindex(columns=self.final_features).copy()
        for col in self.final_cat_cols:
            if col in model_input.columns:
                model_input[col] = model_input[col].astype('category')

        imputed_numeric = pd.DataFrame(
            self.imputer.transform(model_input[self.numeric_cols]),
            columns=self.numeric_cols, index=model_input.index
        )
        
        # FIXED: We no longer overwrite the model_input with imputed_numeric.
        # XGB/LGBM/CatBoost must see the raw NaNs to match training behavior!
        
        return model_input, imputed_numeric

    def _run_real_inference(self, account_id: str, raw_row: pd.DataFrame) -> Optional[dict]:
        try:
            model_input, imputed_numeric = self._prepare_model_input(raw_row)

            # Trees get the raw data (with NaNs)
            xgb_proba = float(self.xgb_model.predict_proba(model_input)[:, 1][0])
            lgbm_proba = float(self.lgbm_model.predict_proba(model_input)[:, 1][0])
            cat_proba = float(self.cat_model.predict_proba(model_input)[:, 1][0])
            
            # Isolation Forest gets the imputed data
            if_score = float(self.iso_forest.decision_function(imputed_numeric)[0])
            is_anomaly = bool(self.iso_forest.predict(imputed_numeric)[0] == -1)

            if self.use_stacking:
                meta_row = pd.DataFrame([{
                    'xgb': xgb_proba, 'lgbm': lgbm_proba, 'cat': cat_proba, 'if_score': if_score
                }])
                proba = float(self.meta_model.predict_proba(meta_row)[:, 1][0])
            else:
                proba = (xgb_proba + lgbm_proba + cat_proba) / 3.0

            scaled_anom_score = round(min(max(0.5 - if_score, 0.0), 1.0), 2)
            risk_score = int(round(proba * 1000))
            
            level, stage = self._bucket_risk(proba)
            human_review = self._route_hitl(proba, is_anomaly)

            shap_explanation = self._explain(model_input)
            damage_metrics = self._estimate_damage(raw_row, proba)
            network_connections = self._build_network_connections(account_id, raw_row, risk_score)

            acct_type = str(raw_row[_ACCT_TYPE_COL].iloc[0]) if _ACCT_TYPE_COL in raw_row.columns and pd.notna(raw_row[_ACCT_TYPE_COL].iloc[0]) else "Unknown"
            occ = str(raw_row[_OCCUPATION_COL].iloc[0]) if _OCCUPATION_COL in raw_row.columns and pd.notna(raw_row[_OCCUPATION_COL].iloc[0]) else "Unknown"
            age_val = int(raw_row[_AGE_COL].iloc[0]) if _AGE_COL in raw_row.columns and pd.notna(raw_row[_AGE_COL].iloc[0]) else 0

            return {
                "account_id": account_id,
                "account_type": acct_type,
                "occupation": occ,
                "age": age_val,
                "anomaly_score": scaled_anom_score,
                "model_probability": proba,
                "risk_score": risk_score,
                "risk_level": level,
                "kill_chain_stage": stage,
                "damage_metrics": damage_metrics,
                "shap_explanation": shap_explanation,
                "network_connections": network_connections,
                "human_review": human_review,
                "is_simulated": False,
                "was_seen_during_training": account_id in self.train_account_ids,
            }
        except Exception as e:
            print(f"Real inference failed for {account_id}: {e}")
            return None

    def _run_batch_inference(self, df: pd.DataFrame) -> list:
        try:
            model_input = df.reindex(columns=self.final_features).copy()
            for col in self.final_cat_cols:
                if col in model_input.columns:
                    model_input[col] = model_input[col].astype('category')

            imputed_numeric = pd.DataFrame(
                self.imputer.transform(model_input[self.numeric_cols]),
                columns=self.numeric_cols, index=model_input.index
            )

            # FIXED: We no longer overwrite the model_input with imputed_numeric.
            
            xgb_proba = self.xgb_model.predict_proba(model_input)[:, 1]
            lgbm_proba = self.lgbm_model.predict_proba(model_input)[:, 1]
            cat_proba = self.cat_model.predict_proba(model_input)[:, 1]
            
            # Isolation forest gets imputed data
            if_scores = self.iso_forest.decision_function(imputed_numeric)
            is_anomalies = self.iso_forest.predict(imputed_numeric) == -1

            if self.use_stacking:
                meta_input = pd.DataFrame({
                    'xgb': xgb_proba, 'lgbm': lgbm_proba, 'cat': cat_proba, 'if_score': if_scores
                })
                probas = self.meta_model.predict_proba(meta_input)[:, 1]
            else:
                probas = (xgb_proba + lgbm_proba + cat_proba) / 3.0

            inflows = pd.to_numeric(df[_INFLOW_COL], errors='coerce').fillna(0.0).values if _INFLOW_COL in df.columns else np.zeros(len(df))
            cash_outs = pd.to_numeric(df[_CASH_OUT_COL], errors='coerce').fillna(0.0).values if _CASH_OUT_COL in df.columns else np.zeros(len(df))
            
            acct_types = df[_ACCT_TYPE_COL].fillna("Unknown").astype(str).values if _ACCT_TYPE_COL in df.columns else np.full(len(df), "Unknown")
            occupations = df[_OCCUPATION_COL].fillna("Unknown").astype(str).values if _OCCUPATION_COL in df.columns else np.full(len(df), "Unknown")
            ages = pd.to_numeric(df[_AGE_COL], errors='coerce').fillna(0).astype(int).values if _AGE_COL in df.columns else np.zeros(len(df), dtype=int)
            
            acc_ids = df['account_id'].values

            results = []
            for i in range(len(df)):
                p = float(probas[i])
                anom = bool(is_anomalies[i])
                raw_if_score = float(if_scores[i])
                
                scaled_anom_score = round(min(max(0.5 - raw_if_score, 0.0), 1.0), 2)
                r_score = int(round(p * 1000))
                
                lvl, stg = self._bucket_risk(p)
                hitl = self._route_hitl(p, anom)
                
                recoverable = round(max(float(inflows[i]) - float(cash_outs[i]), 0.0) * p, 2)
                transit = round(float(cash_outs[i]) * p, 2)

                results.append({
                    "account_id": str(acc_ids[i]),
                    "account_type": str(acct_types[i]),
                    "occupation": str(occupations[i]),
                    "age": int(ages[i]),
                    "anomaly_score": scaled_anom_score,
                    "model_probability": p,
                    "risk_score": r_score,
                    "risk_level": lvl,
                    "kill_chain_stage": stg,
                    "damage_metrics": {
                        "recoverable_amount": recoverable,
                        "in_transit_amount": transit,
                        "is_estimated": True,
                        "estimation_note": "Batch evaluation."
                    },
                    "shap_explanation": [], 
                    "network_connections": {"nodes": [{"id": str(acc_ids[i]), "type": "mule" if r_score > 600 else "normal"}], "edges": []},
                    "human_review": hitl,
                    "is_simulated": False,
                    "was_seen_during_training": str(acc_ids[i]) in self.train_account_ids,
                })
            
            results.sort(key=lambda x: x['risk_score'], reverse=True)
            return results
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return []

    def _estimate_damage(self, raw_row: pd.DataFrame, proba: float) -> dict:
        inflow = float(raw_row[_INFLOW_COL].iloc[0]) if _INFLOW_COL in raw_row.columns and pd.notna(raw_row[_INFLOW_COL].iloc[0]) else 0.0
        cash_out = float(raw_row[_CASH_OUT_COL].iloc[0]) if _CASH_OUT_COL in raw_row.columns and pd.notna(raw_row[_CASH_OUT_COL].iloc[0]) else 0.0
        in_transit_amount = round(cash_out * proba, 2)
        recoverable_amount = round(max(inflow - cash_out, 0.0) * proba, 2)
        return {
            "recoverable_amount": recoverable_amount,
            "in_transit_amount": in_transit_amount,
            "is_estimated": True,
            "estimation_note": "Derived from account inflow/cash-out feature values and model confidence.",
        }

    def _build_network_connections(self, account_id: str, raw_row: pd.DataFrame, risk_score: int) -> dict:
        try:
            inflow = float(raw_row[_INFLOW_COL].iloc[0]) if _INFLOW_COL in raw_row.columns and pd.notna(raw_row[_INFLOW_COL].iloc[0]) else 0.0
            cash_out = float(raw_row[_CASH_OUT_COL].iloc[0]) if _CASH_OUT_COL in raw_row.columns and pd.notna(raw_row[_CASH_OUT_COL].iloc[0]) else 0.0
            counterparty_hint = 0
            if _COUNTERPARTY_COL in raw_row.columns and pd.notna(raw_row[_COUNTERPARTY_COL].iloc[0]):
                try:
                    counterparty_hint = int(raw_row[_COUNTERPARTY_COL].iloc[0])
                except (ValueError, TypeError):
                    pass

            graph = self._graph_initializer.build_synthetic_account_neighborhood(
                account_id=account_id, risk_score=risk_score,
                inflow=inflow, cash_out=cash_out, counterparty_hint=counterparty_hint,
            )
            return self._graph_initializer.compute_network_intelligence(graph, account_id)
        except Exception:
            return {"nodes": [{"id": account_id, "type": "mule" if risk_score > 600 else "normal"}], "edges": []}

    def _explain(self, model_input: pd.DataFrame) -> list:
        if self._shap_explainer is None: return []
        try:
            shap_values = self._shap_explainer.shap_values(model_input)
            row_values = shap_values[0] if len(shap_values.shape) > 1 else shap_values
            contributions = sorted(zip(model_input.columns, row_values), key=lambda x: abs(x[1]), reverse=True)[:5]
            return [{"feature": str(f), "contribution": round(float(v), 4)} for f, v in contributions]
        except Exception:
            return []

    def _run_simulated_inference(self, account_id: str) -> dict:
        seed_val = sum(ord(char) * (idx + 1) for idx, char in enumerate(account_id))
        pass_through_ratio = round((sum(ord(c) for c in account_id) % 100) / 100.0, 2)
        risk_score = int(min(300 + (pass_through_ratio * 600) + ((seed_val % 101) - 50), 1000))
        proba = risk_score / 1000.0
        
        level, stage = self._bucket_risk(proba)
        
        dest_id = f"BOI-{10000 + (seed_val % 90000)}"
        in_transit = round(risk_score * 340.25, 2)

        return {
            "account_id": account_id,
            "account_type": "Unknown (Simulated)",
            "occupation": "Unknown (Simulated)",
            "age": 0,
            "anomaly_score": pass_through_ratio,
            "model_probability": proba,
            "risk_score": risk_score,
            "risk_level": level,
            "kill_chain_stage": stage,
            "damage_metrics": {
                "recoverable_amount": round(risk_score * 1250.50, 2),
                "in_transit_amount": in_transit,
                "is_estimated": True,
                "estimation_note": "Simulated - no trained model artifact or matching account found.",
            },
            "shap_explanation": [{"feature": "pass_through_ratio", "contribution": pass_through_ratio}],
            "network_connections": {
                "nodes": [{"id": account_id, "type": "mule"}, {"id": dest_id, "type": "cash_out"}],
                "edges": [{"source": account_id, "target": dest_id, "amount": round(in_transit * 0.8, 2)}],
            },
            "human_review": {
                "requires_review": True,
                "review_reason": "simulated_result_not_verified",
                "confidence_band": "HUMAN_REVIEW",
                "anomaly_flagged": False,
            },
            "is_simulated": True,
            "was_seen_during_training": False,
        }

    def evaluate_account(self, account_id: str) -> dict:
        if self.artifact is not None:
            raw_row = self._get_account_row(account_id)
            if raw_row is not None:
                result = self._run_real_inference(account_id, raw_row)
                if result is not None:
                    return result
        return self._run_simulated_inference(account_id)

    def get_accounts(self, limit: Optional[int] = 200, held_out_only: bool = True) -> list:
        df = self._load_dataset()
        if df is None or 'account_id' not in df.columns:
            return [self.evaluate_account(f"AC{1000 + i}") for i in range(limit or 50)]
            
        if self.artifact is not None:
            if held_out_only:
                df = df[~df['account_id'].astype(str).isin(self.train_account_ids)]
            
            results = self._run_batch_inference(df)
            return results[:limit] if limit else results
            
        ids = df['account_id'].astype(str)
        if held_out_only and hasattr(self, 'train_account_ids'):
            ids = ids[~ids.isin(self.train_account_ids)]
        
        account_ids = ids.head(limit or 50).tolist()
        return [self.evaluate_account(ac_id) for ac_id in account_ids]

# Singleton instance
mule_analyzer = MuleRiskAnalyzer()