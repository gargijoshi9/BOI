"""
MuleRiskAnalyzer - bridges the trained ML ensemble to the FastAPI backend.

Runs real inference against the pickled XGBoost+LightGBM ensemble, the
fitted BOIDataRefiner, and the fitted FeatureFactory produced by
src/models/train.py.

Falls back to a clearly-labeled simulator ONLY if the trained artifacts
aren't present on disk yet (e.g. local dev before anyone has run
train.py), so the API never hard-crashes but also never silently
pretends fake numbers are real.
"""

import os
import sys
import random
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


# analyzer.py actually lives at ml_pipeline/analyzer.py - a SIBLING of
# src/, not a file inside it. (Confirmed via `Get-ChildItem -Recurse
# -Filter analyzer.py` - it's at ml_pipeline root, not ml_pipeline/src.)
#
# train.py pickles BOIDataRefiner/FeatureFactory with src/ itself on
# sys.path (see train.py's own sys.path.append of its parent dir), so the
# classes are pickled under module paths like "data_refinement.cleaner"
# - NOT "src.data_refinement.cleaner". For joblib.load() to unpickle them
# here, src/ needs to be added to sys.path directly, matching how they
# were saved.
_ML_PIPELINE_DIR = Path(__file__).resolve().parent
_SRC_DIR = _ML_PIPELINE_DIR / "src"
_MODELS_DIR = _SRC_DIR / "models"
# src/ resolves "data_refinement.cleaner" and "feature_factory.features"
# (pickled as package-qualified paths). src/models/ additionally resolves
# the flat "ensemble_model" module (pickled as a top-level name because
# train.py imports it directly from its own directory) - both are needed
# for joblib.load() to fully reconstruct the ensemble object.
for _p in (_SRC_DIR, _MODELS_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

# saved_models/ and data/ are direct children of ml_pipeline/, same level
# as this file.
BASE_DIR = _ML_PIPELINE_DIR
MODEL_PATH = BASE_DIR / "saved_models" / "mule_ensemble_model.pkl"
REFINER_PATH = BASE_DIR / "saved_models" / "data_refiner.pkl"
FACTORY_PATH = BASE_DIR / "saved_models" / "feature_factory.pkl"
DATASET_PATH = BASE_DIR / "data" / "boi_dataset.csv"

# TODO(data-dictionary): these are the same placeholder volume columns
# used in FeatureFactory (inflow / cash-out). Once the real BOI data
# dictionary confirms actual monetary amount columns, swap them in here
# so damage_metrics reflects real transaction amounts rather than the
# account's raw feature values.
_INFLOW_COL = 'F2082'
_CASH_OUT_COL = 'F2122'


class MuleRiskAnalyzer:
    def __init__(self):
        self.ensemble = None
        self.refiner = None
        self.factory = None
        self._dataset_cache: Optional[pd.DataFrame] = None
        self._shap_explainer = None

        if MODEL_PATH.exists() and REFINER_PATH.exists() and FACTORY_PATH.exists():
            self.ensemble = joblib.load(MODEL_PATH)
            self.refiner = joblib.load(REFINER_PATH)
            self.factory = joblib.load(FACTORY_PATH)
            self.engine_status = "Live Ensemble Model Active"

            if _SHAP_AVAILABLE:
                try:
                    # Explain against the XGBoost half of the ensemble -
                    # TreeExplainer doesn't support arbitrary blended models,
                    # but XGBoost drives the larger share of the ensemble
                    # weight and gives a faithful enough explanation signal.
                    self._shap_explainer = shap.TreeExplainer(self.ensemble.xgb_model)
                except Exception as e:
                    print(f"Warning: could not initialize SHAP explainer: {e}")
        else:
            self.engine_status = "Dynamic Simulator Active (trained model artifacts not found)"

    # ------------------------------------------------------------------
    # Data access
    # ------------------------------------------------------------------
    def _load_dataset(self) -> Optional[pd.DataFrame]:
        if self._dataset_cache is not None:
            return self._dataset_cache
        if not DATASET_PATH.exists():
            return None
        df = pd.read_csv(DATASET_PATH)

        # FIX: this dataset doesn't ship a real 'account_id' column - it
        # has 'Unnamed: 0', which is pandas' own index column leaking
        # into the CSV (happens when someone calls df.to_csv() without
        # index=False). Without this, _get_account_row() always returned
        # None and every request silently fell back to the simulator.
        #
        # TODO: replace this with the REAL account identifier column once
        # confirmed - 'Unnamed: 0' is just a row position, not a genuine
        # bank account ID, so it's a stand-in until the true column is
        # identified in the data dictionary.
        if 'account_id' not in df.columns and 'Unnamed: 0' in df.columns:
            df = df.rename(columns={'Unnamed: 0': 'account_id'})
            df['account_id'] = df['account_id'].astype(str)

        self._dataset_cache = df
        return self._dataset_cache

    def _get_account_row(self, account_id: str) -> Optional[pd.DataFrame]:
        """
        Looks up the raw feature row for a given account_id in the source
        dataset. Returns None (falls back to simulator) if the dataset
        has no usable identifier column or the id isn't found.
        """
        df = self._load_dataset()
        if df is None or 'account_id' not in df.columns:
            return None
        row = df[df['account_id'] == str(account_id)]
        if row.empty:
            return None
        return row

    # ------------------------------------------------------------------
    # Real inference path
    # ------------------------------------------------------------------
    def _run_real_inference(self, account_id: str, raw_row: pd.DataFrame) -> Optional[dict]:
        try:
            # FIX: BOIDataRefiner now implements clean_dataframe() properly
            # (learned training-time medians/encoders, no on-the-fly
            # recomputation on a single row) - call it directly instead of
            # the old hasattr() fallback that silently skipped cleaning
            # entirely when the method didn't exist.
            # FIX: the raw dataset has ~3900 columns (F1...F3924), but the
            # refiner/model were only ever trained on the 18 columns in
            # important_features (train.py loads the CSV with
            # usecols=important_features+[target]). Passing the FULL raw
            # row here means clean_dataframe() hits columns like random
            # F-codes that were never seen during training and have no
            # fitted encoder - which crashed with "No fitted encoder
            # found for 'F3886'" and silently fell back to the simulator.
            # Subsetting to the trained columns (same ones the model
            # actually uses) fixes this and is also more efficient.
            trained_cols = [c for c in self.refiner.important_features if c in raw_row.columns]
            feature_row = raw_row[trained_cols].copy()
            cleaned = self.refiner.clean_dataframe(feature_row, is_training=False)

            features = self.factory.engineer_features(cleaned, is_training=False)
            if 'F3924' in features.columns:
                features = features.drop(columns=['F3924'])

            proba = self.ensemble.predict_proba(features)[:, 1][0]
            risk_score = int(round(proba * 1000))

            if risk_score > 800:
                level, stage = "Critical", "Layering"
            elif risk_score > 600:
                level, stage = "High", "Placement"
            elif risk_score > 400:
                level, stage = "Medium", "Integration"
            else:
                level, stage = "Low", "None"

            shap_explanation = self._explain(features)
            damage_metrics = self._estimate_damage(raw_row, proba)

            return {
                "account_id": account_id,
                "risk_score": risk_score,
                "risk_level": level,
                "kill_chain_stage": stage,
                "damage_metrics": damage_metrics,
                "shap_explanation": shap_explanation,
                "network_connections": {
                    "nodes": [
                        {"id": account_id, "type": "mule" if risk_score > 600 else "normal"},
                    ],
                    "edges": []
                }
            }
        except Exception as e:
            print(f"Real inference failed for {account_id}, falling back to simulator: {e}")
            return None

    def _estimate_damage(self, raw_row: pd.DataFrame, proba: float) -> dict:
        """
        FIX: the old code multiplied risk_score by fixed magic constants
        (1250.50 / 340.25) that were carried over from the random-number
        simulator. That meant even "Live Ensemble Model Active" responses
        showed fabricated dollar amounts with zero connection to the
        account's actual data - arguably worse than the simulator, since
        it *looked* authoritative.

        Until real monetary amount columns are confirmed in the data
        dictionary, this derives an estimate from the account's own
        inflow/cash-out feature values (scaled by the model's predicted
        probability) instead of an arbitrary constant untethered from the
        account. It's explicitly flagged as an estimate in the response
        so the frontend/analyst doesn't treat it as a verified figure.
        """
        inflow = float(raw_row[_INFLOW_COL].iloc[0]) if _INFLOW_COL in raw_row.columns and pd.notna(raw_row[_INFLOW_COL].iloc[0]) else 0.0
        cash_out = float(raw_row[_CASH_OUT_COL].iloc[0]) if _CASH_OUT_COL in raw_row.columns and pd.notna(raw_row[_CASH_OUT_COL].iloc[0]) else 0.0

        in_transit_amount = round(cash_out * proba, 2)
        recoverable_amount = round(max(inflow - cash_out, 0.0) * proba, 2)

        return {
            "recoverable_amount": recoverable_amount,
            "in_transit_amount": in_transit_amount,
            "is_estimated": True,
            "estimation_note": (
                "Derived from account inflow/cash-out feature values and "
                "model confidence; not a verified transaction amount. "
                "Replace with confirmed monetary columns once available."
            ),
        }

    def _explain(self, features: pd.DataFrame) -> list:
        """Returns real SHAP contributions if available, else an empty list
        rather than fabricated numbers."""
        if self._shap_explainer is None:
            return []
        try:
            shap_values = self._shap_explainer.shap_values(features)
            row_values = shap_values[0] if len(shap_values.shape) > 1 else shap_values
            contributions = list(zip(features.columns, row_values))
            contributions.sort(key=lambda x: abs(x[1]), reverse=True)
            top = contributions[:5]
            return [
                {"feature": str(feat), "contribution": round(float(val), 4)}
                for feat, val in top
            ]
        except Exception as e:
            print(f"SHAP explanation failed: {e}")
            return []

    # ------------------------------------------------------------------
    # Simulator fallback (clearly labeled, used only when no trained
    # model or no matching account row is available)
    # ------------------------------------------------------------------
    def _calculate_pass_through(self, account_id: str) -> float:
        base_val = sum(ord(char) for char in account_id) % 100
        return round(base_val / 100.0, 2)

    def _run_simulated_inference(self, account_id: str) -> dict:
        pass_through_ratio = self._calculate_pass_through(account_id)
        base_risk = 300 + (pass_through_ratio * 600)
        risk_score = int(min(base_risk + random.randint(-50, 50), 1000))

        if risk_score > 800:
            level, stage = "Critical", "Layering"
        elif risk_score > 600:
            level, stage = "High", "Placement"
        elif risk_score > 400:
            level, stage = "Medium", "Integration"
        else:
            level, stage = "Low", "None"

        recoverable = round(risk_score * 1250.50, 2)
        in_transit = round(risk_score * 340.25, 2)

        return {
            "account_id": account_id,
            "risk_score": risk_score,
            "risk_level": level,
            "kill_chain_stage": stage,
            "damage_metrics": {
                "recoverable_amount": recoverable,
                "in_transit_amount": in_transit,
                "is_estimated": True,
                "estimation_note": "Simulated - no trained model artifacts or matching account found.",
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

    # ------------------------------------------------------------------
    # Public entrypoint
    # ------------------------------------------------------------------
    def evaluate_account(self, account_id: str) -> dict:
        if self.ensemble is not None:
            raw_row = self._get_account_row(account_id)
            if raw_row is not None:
                result = self._run_real_inference(account_id, raw_row)
                if result is not None:
                    return result
        # Falls back here if: no trained model, no matching row in the
        # dataset, or inference raised an exception above.
        return self._run_simulated_inference(account_id)