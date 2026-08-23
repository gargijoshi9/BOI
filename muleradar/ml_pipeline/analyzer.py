"""
MuleRiskAnalyzer - bridges the trained ML ensemble (mule_pipeline_v2.pkl) to the FastAPI backend.
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
for _p in (_SRC_DIR, _SRC_DIR / "graph_engine"):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

try:
    from graph_initializer import TransactionGraphInitializer
except ImportError:
    class TransactionGraphInitializer:
        def build_synthetic_account_neighborhood(self, **kwargs): return {}
        def compute_network_intelligence(self, graph, account_id):
            return {"nodes": [{"id": account_id, "type": "account"}], "edges": []}

# Attempt to load the dictionary translator
try:
    from explainability.feature_dictionary import translate_feature
except ImportError:
    def translate_feature(code): return {"code": code, "variable_name": code, "description": "Definition unavailable"}

BASE_DIR = _ML_PIPELINE_DIR
ARTIFACT_PATH = BASE_DIR / "saved_models" / "mule_pipeline_v2.pkl"
DATASET_PATH = BASE_DIR / "data" / "boi_dataset.csv"

_INFLOW_COL, _CASH_OUT_COL, _COUNTERPARTY_COL = 'F2082', 'F2122', 'F2678'
_ACCT_TYPE_COL, _OCCUPATION_COL, _AGE_COL = 'F3886', 'F3891', 'F3894'

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
            self.train_account_ids = set(str(a) for a in self.artifact.get('train_account_ids', []))

            self.imputer = self.artifact['imputer']
            self.xgb_model = self.artifact['xgb_model']
            self.lgbm_model = self.artifact['lgbm_model']
            self.cat_model = self.artifact['cat_model']
            self.iso_forest = self.artifact['iso_forest']
            self.meta_model = self.artifact['meta_model']
            self.use_stacking = self.artifact['use_stacking']
            self.optimal_threshold = self.artifact.get('optimal_threshold', 0.986)

            if _SHAP_AVAILABLE:
                try: self._shap_explainer = shap.TreeExplainer(self.xgb_model)
                except Exception: pass

    def _load_dataset(self) -> Optional[pd.DataFrame]:
        if self._dataset_cache is not None: return self._dataset_cache
        if not DATASET_PATH.exists(): return None
        df = pd.read_csv(DATASET_PATH)
        if 'account_id' not in df.columns and 'Unnamed: 0' in df.columns:
            df = df.rename(columns={'Unnamed: 0': 'account_id'})
            df['account_id'] = df['account_id'].astype(str)
        df.columns = ['account_id' if c == 'account_id' else re.sub(r'[\[\]{} ,:]', '_', c) for c in df.columns]
        self._dataset_cache = df
        return self._dataset_cache

    def _get_account_row(self, account_id: str) -> Optional[pd.DataFrame]:
        df = self._load_dataset()
        if df is None: return None
        row = df[df['account_id'] == str(account_id)]
        return None if row.empty else row

    def _compute_risk_score(self, raw_proba: float) -> int:
        t_high = getattr(self, 'optimal_threshold', 0.9860)
        t_critical = 0.9985 
        t_med = max(t_high * 0.60, 0.40)
        if t_critical <= t_high: t_critical = t_high + 0.001
        
        p = float(raw_proba)
        if p >= t_critical: score = 900 + ((p - t_critical) / (1.0 - t_critical + 1e-9)) * 100
        elif p >= t_high: score = 750 + ((p - t_high) / (t_critical - t_high + 1e-9)) * 149
        elif p >= t_med: score = 450 + ((p - t_med) / (t_high - t_med + 1e-9)) * 299
        else: score = (p / (t_med + 1e-9)) * 449
        return int(round(min(max(score, 0), 1000)))

    def _bucket_risk(self, risk_score: int):
        if risk_score >= 900: return "Critical", "Layering"
        elif risk_score >= 750: return "High", "Placement"
        elif risk_score >= 450: return "Medium", "Integration"
        return "Low", "None"

    def _route_hitl(self, risk_score: int, is_anomaly: bool) -> dict:
        if risk_score >= 900: band, requires_review, reason = "AUTO_BLOCK", False, None
        elif risk_score < 450: band, requires_review, reason = "AUTO_CLEAR", False, None
        else: band, requires_review, reason = "HUMAN_REVIEW", True, "borderline_confidence"
        if is_anomaly and band == "AUTO_CLEAR": band, requires_review, reason = "HUMAN_REVIEW", True, "anomaly_override"
        return {"requires_review": requires_review, "review_reason": reason, "confidence_band": band, "anomaly_flagged": is_anomaly}

    def _prepare_model_input(self, raw_row: pd.DataFrame):
        model_input = raw_row.reindex(columns=self.final_features).copy()
        for col in self.final_cat_cols:
            if col in model_input.columns: model_input[col] = model_input[col].astype('category')
        imputed_numeric = pd.DataFrame(self.imputer.transform(model_input[self.numeric_cols]), columns=self.numeric_cols, index=model_input.index)
        return model_input, imputed_numeric

    def _run_real_inference(self, account_id: str, raw_row: pd.DataFrame) -> Optional[dict]:
        try:
            model_input, imputed_numeric = self._prepare_model_input(raw_row)

            xgb_proba = float(self.xgb_model.predict_proba(model_input)[:, 1][0])
            lgbm_proba = float(self.lgbm_model.predict_proba(model_input)[:, 1][0])
            cat_proba = float(self.cat_model.predict_proba(model_input)[:, 1][0])
            if_score = float(self.iso_forest.decision_function(imputed_numeric)[0])
            is_anomaly = bool(self.iso_forest.predict(imputed_numeric)[0] == -1)

            if self.use_stacking:
                meta_row = pd.DataFrame([{'xgb': xgb_proba, 'lgbm': lgbm_proba, 'cat': cat_proba, 'if_score': if_score}])
                proba = float(self.meta_model.predict_proba(meta_row)[:, 1][0])
            else:
                proba = (xgb_proba + lgbm_proba + cat_proba) / 3.0

            scaled_anom_score = round(min(max(0.5 - if_score, 0.0), 1.0), 2)
            risk_score = self._compute_risk_score(proba)
            level, stage = self._bucket_risk(risk_score)

            return {
                "account_id": account_id,
                "account_type": str(raw_row[_ACCT_TYPE_COL].iloc[0]) if _ACCT_TYPE_COL in raw_row.columns and pd.notna(raw_row[_ACCT_TYPE_COL].iloc[0]) else "Unknown",
                "occupation": str(raw_row[_OCCUPATION_COL].iloc[0]) if _OCCUPATION_COL in raw_row.columns and pd.notna(raw_row[_OCCUPATION_COL].iloc[0]) else "Unknown",
                "age": int(raw_row[_AGE_COL].iloc[0]) if _AGE_COL in raw_row.columns and pd.notna(raw_row[_AGE_COL].iloc[0]) else 0,
                "anomaly_score": scaled_anom_score,
                "model_probability": proba, 
                "risk_score": risk_score,
                "risk_level": level,
                "kill_chain_stage": stage,
                "damage_metrics": self._estimate_damage(raw_row, proba),
                "model_component_scores": {
                    "xgb_probability": xgb_proba, "lgbm_probability": lgbm_proba, "cat_probability": cat_proba,
                    "anomaly_score_if": if_score, "combination_method": "stacked_meta_learner" if self.use_stacking else "equal_weight_blend"
                },
                "shap_explanation": self._explain(model_input),
                "network_connections": self._build_network_connections(account_id, raw_row, risk_score),
                "human_review": self._route_hitl(risk_score, is_anomaly),
                "is_simulated": False,
                "was_seen_during_training": account_id in self.train_account_ids,
            }
        except Exception:
            return None

    def _run_batch_inference(self, df: pd.DataFrame) -> list:
        try:
            model_input = df.reindex(columns=self.final_features).copy()
            for col in self.final_cat_cols:
                if col in model_input.columns: model_input[col] = model_input[col].astype('category')
            imputed_numeric = pd.DataFrame(self.imputer.transform(model_input[self.numeric_cols]), columns=self.numeric_cols, index=model_input.index)

            xgb_proba = self.xgb_model.predict_proba(model_input)[:, 1]
            lgbm_proba = self.lgbm_model.predict_proba(model_input)[:, 1]
            cat_proba = self.cat_model.predict_proba(model_input)[:, 1]
            if_scores = self.iso_forest.decision_function(imputed_numeric)
            is_anomalies = self.iso_forest.predict(imputed_numeric) == -1

            if self.use_stacking:
                meta_input = pd.DataFrame({'xgb': xgb_proba, 'lgbm': lgbm_proba, 'cat': cat_proba, 'if_score': if_scores})
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
                p, anom = float(probas[i]), bool(is_anomalies[i])
                r_score = self._compute_risk_score(p)
                lvl, stg = self._bucket_risk(r_score)
                
                results.append({
                    "account_id": str(acc_ids[i]), "account_type": str(acct_types[i]), "occupation": str(occupations[i]), "age": int(ages[i]),
                    "anomaly_score": round(min(max(0.5 - float(if_scores[i]), 0.0), 1.0), 2),
                    "model_probability": p, "risk_score": r_score, "risk_level": lvl, "kill_chain_stage": stg,
                    "damage_metrics": {"recoverable_amount": round(max(float(inflows[i]) - float(cash_outs[i]), 0.0) * p, 2), "in_transit_amount": round(float(cash_outs[i]) * p, 2), "is_estimated": True},
                    "model_component_scores": {"xgb_probability": float(xgb_proba[i]), "lgbm_probability": float(lgbm_proba[i]), "cat_probability": float(cat_proba[i]), "anomaly_score_if": float(if_scores[i]), "combination_method": "stacked" if self.use_stacking else "blend"},
                    "shap_explanation": [], 
                    "network_connections": {"nodes": [{"id": str(acc_ids[i]), "type": "mule" if r_score > 600 else "normal"}], "edges": []},
                    "human_review": self._route_hitl(r_score, anom),
                    "is_simulated": False, "was_seen_during_training": str(acc_ids[i]) in self.train_account_ids,
                })
            results.sort(key=lambda x: x['risk_score'], reverse=True)
            return results
        except Exception:
            return []

    def _estimate_damage(self, raw_row: pd.DataFrame, proba: float) -> dict:
        inflow = float(raw_row[_INFLOW_COL].iloc[0]) if _INFLOW_COL in raw_row.columns and pd.notna(raw_row[_INFLOW_COL].iloc[0]) else 0.0
        cash_out = float(raw_row[_CASH_OUT_COL].iloc[0]) if _CASH_OUT_COL in raw_row.columns and pd.notna(raw_row[_CASH_OUT_COL].iloc[0]) else 0.0
        return {"recoverable_amount": round(max(inflow - cash_out, 0.0) * proba, 2), "in_transit_amount": round(cash_out * proba, 2), "is_estimated": True}

    def _build_network_connections(self, account_id: str, raw_row: pd.DataFrame, risk_score: int) -> dict:
        try:
            inflow = float(raw_row[_INFLOW_COL].iloc[0]) if _INFLOW_COL in raw_row.columns and pd.notna(raw_row[_INFLOW_COL].iloc[0]) else 0.0
            cash_out = float(raw_row[_CASH_OUT_COL].iloc[0]) if _CASH_OUT_COL in raw_row.columns and pd.notna(raw_row[_CASH_OUT_COL].iloc[0]) else 0.0
            hint = int(raw_row[_COUNTERPARTY_COL].iloc[0]) if _COUNTERPARTY_COL in raw_row.columns and pd.notna(raw_row[_COUNTERPARTY_COL].iloc[0]) else 0
            graph = self._graph_initializer.build_synthetic_account_neighborhood(account_id=account_id, risk_score=risk_score, inflow=inflow, cash_out=cash_out, counterparty_hint=hint)
            return self._graph_initializer.compute_network_intelligence(graph, account_id)
        except Exception:
            return {"nodes": [{"id": account_id, "type": "mule" if risk_score > 600 else "normal"}], "edges": []}

    def _explain(self, model_input: pd.DataFrame) -> list:
        if self._shap_explainer is None: return []
        try:
            shap_values = self._shap_explainer.shap_values(model_input)
            row_values = shap_values[0] if len(shap_values.shape) > 1 else shap_values
            contributions = sorted(zip(model_input.columns, row_values), key=lambda x: abs(x[1]), reverse=True)[:5]
            
            result = []
            for f, v in contributions:
                info = translate_feature(str(f))
                result.append({
                    "feature": str(f),
                    "contribution": round(float(v), 4),
                    "display_name": info["variable_name"],
                    "description": info["description"]
                })
            return result
        except Exception:
            return []

    def _run_simulated_inference(self, account_id: str) -> dict:
        return {"account_id": account_id, "risk_score": 0, "risk_level": "Low", "kill_chain_stage": "None", "damage_metrics": {"recoverable_amount": 0.0, "in_transit_amount": 0.0, "is_estimated": True}, "shap_explanation": [], "network_connections": {"nodes": [], "edges": []}, "human_review": {"requires_review": False, "confidence_band": "AUTO_CLEAR", "anomaly_flagged": False}, "is_simulated": True, "was_seen_during_training": False}

    def evaluate_account(self, account_id: str) -> dict:
        if self.artifact is not None:
            raw_row = self._get_account_row(account_id)
            if raw_row is not None:
                result = self._run_real_inference(account_id, raw_row)
                if result is not None: return result
        return self._run_simulated_inference(account_id)

    def get_accounts(self, limit: Optional[int] = 200, held_out_only: bool = True) -> list:
        df = self._load_dataset()
        if df is None: return []
        if self.artifact is not None:
            if held_out_only: df = df[~df['account_id'].astype(str).isin(self.train_account_ids)]
            results = self._run_batch_inference(df)
            return results[:limit] if limit else results
        return []

mule_analyzer = MuleRiskAnalyzer()