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

_ML_PIPELINE_DIR = Path(__file__).resolve().parent
_SRC_DIR = _ML_PIPELINE_DIR / "src"
_MODELS_DIR = _SRC_DIR / "models"
_GRAPH_ENGINE_DIR = _SRC_DIR / "graph_engine"
_EXPLAINABILITY_DIR = _SRC_DIR / "explainability"

for _p in (_ML_PIPELINE_DIR, _SRC_DIR, _MODELS_DIR, _GRAPH_ENGINE_DIR, _EXPLAINABILITY_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

try:
    from src.explainability.shap_explainer import ShapExplainerService, to_waterfall_json
    _SHAP_AVAILABLE = True
except ImportError:
    try:
        from explainability.shap_explainer import ShapExplainerService, to_waterfall_json
        _SHAP_AVAILABLE = True
    except ImportError:
        _SHAP_AVAILABLE = False

from graph_initializer import TransactionGraphInitializer

# saved_models/ and data/ are direct children of ml_pipeline/, same level
# as this file.
BASE_DIR = _ML_PIPELINE_DIR
MODEL_PATH = BASE_DIR / "saved_models" / "mule_ensemble_model.pkl"
REFINER_PATH = BASE_DIR / "saved_models" / "data_refiner.pkl"
FACTORY_PATH = BASE_DIR / "saved_models" / "feature_factory.pkl"
DATASET_PATH = BASE_DIR / "data" / "boi_dataset.csv"

# TODO(data-dictionary): these are still placeholder volume columns
# for the damage-estimate DISPLAY numbers only (not model inputs - the
# model itself now uses the real F3800/F3801 total amount columns, see
# FeatureFactory). Swap these to F3800 (TOT_TXNAMT_CR_L31D) / F3801
# (TOT_TXNAMT_DB_L31D) as well once damage-estimate accuracy is
# revisited (tracked as a Day-4 item) - kept as F2082/F2122 here for
# now since that only changes displayed rupee figures, not anything the
# model is trained/scored on.
# Real transaction total rupee amount columns from official BOI dictionary
# F3800 = TOT_TXNAMT_CR_L31D (Total Credit Inflow in 31 days)
# F3801 = TOT_TXNAMT_DB_L31D (Total Debit Outflow in 31 days)
_INFLOW_COL = 'F3800'
_CASH_OUT_COL = 'F3801'

# DAY-1 FIX: F2678 was previously used here as a "rough counterparty-
# count feature" to loosely bound the synthesized network neighborhood
# size. Per the official BOI data dictionary, F2678 is actually
# DA_ELEC_XFER_AMT_L14_31D - an electronic-transfer AMOUNT DEVIATION,
# not a counterparty count. A full-text search of the entire
# ~3924-column data dictionary for anything resembling a real
# counterparty/beneficiary count returned zero matches - no such column
# exists in this dataset at all. Rather than bound the synthesized graph
# neighborhood off a value that has nothing to do with counterparties,
# _build_network_connections() below now always passes
# counterparty_hint=0, which means
# build_synthetic_account_neighborhood() falls back to its own
# risk-based default range (2-4 neighbors normally, up to 6 for
# risk_score > 600) instead of a misleading external bound.
# _COUNTERPARTY_COL constant removed - see counterparty_hint below.


class MuleRiskAnalyzer:
    def __init__(self):
        self.ensemble = None
        self.refiner = None
        self.factory = None
        self._dataset_cache: Optional[pd.DataFrame] = None
        self.explainer_service: Optional[ShapExplainerService] = None
        self._graph_initializer = TransactionGraphInitializer()

        if MODEL_PATH.exists() and REFINER_PATH.exists() and FACTORY_PATH.exists():
            self.ensemble = joblib.load(MODEL_PATH)
            self.refiner = joblib.load(REFINER_PATH)
            self.factory = joblib.load(FACTORY_PATH)
            self.engine_status = "Live Ensemble Model Active"

            if _SHAP_AVAILABLE:
                try:
                    background_df = self._load_dataset()
                    if background_df is None:
                        background_df = pd.DataFrame()
                    xgb_w = getattr(self.ensemble, "xgb_weight", 0.55)
                    lgbm_w = getattr(self.ensemble, "lgbm_weight", 1.0 - xgb_w)
                    self.explainer_service = ShapExplainerService(
                        xgb_model=self.ensemble.xgb_model,
                        lgbm_model=self.ensemble.lgbm_model,
                        xgb_weight=xgb_w,
                        lgbm_weight=lgbm_w,
                        background_df=background_df,
                    )
                except Exception as e:
                    print(f"Warning: could not initialize ShapExplainerService: {e}")
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
        dataset. Returns None if the dataset has no usable identifier column
        or the id isn't found.
        """
        df = self._load_dataset()
        if df is None or 'account_id' not in df.columns:
            return None

        target_id = str(account_id).strip()
        # Clean common user prefixes like 'AC1', 'ac14', 'Account 1'
        if target_id.lower().startswith('account '):
            target_id = target_id[8:].strip()
        elif target_id.lower().startswith('ac') and target_id[2:].isdigit():
            target_id = target_id[2:].strip()

        row = df[df['account_id'] == target_id]
        if row.empty:
            return None
        return row

    # ------------------------------------------------------------------
    # Network intelligence (Day 4)
    # ------------------------------------------------------------------
    def _build_network_connections(self, account_id: str, raw_row: pd.DataFrame, risk_score: int) -> dict:
        """
        Builds the network_connections payload for a real-inference
        result using TransactionGraphInitializer. See
        graph_engine/graph_initializer.py's module docstring for exactly
        what's synthesized vs. genuinely computed here - in short: the
        graph's edges are deterministically synthesized from this
        account's own feature values (no real transaction ledger is
        available yet), but PageRank/Louvain/betweenness-centrality are
        run for real against that graph.
        """
        try:
            inflow = float(raw_row[_INFLOW_COL].iloc[0]) if _INFLOW_COL in raw_row.columns and pd.notna(raw_row[_INFLOW_COL].iloc[0]) else 0.0
            cash_out = float(raw_row[_CASH_OUT_COL].iloc[0]) if _CASH_OUT_COL in raw_row.columns and pd.notna(raw_row[_CASH_OUT_COL].iloc[0]) else 0.0

            # DAY-1 FIX: see the module-level note above _COUNTERPARTY_COL
            # removal - no real counterparty-count column exists in this
            # dataset, so this is always 0.
            counterparty_hint = 0

            graph = self._graph_initializer.build_synthetic_account_neighborhood(
                account_id=account_id,
                risk_score=risk_score,
                inflow=inflow,
                cash_out=cash_out,
                counterparty_hint=counterparty_hint,
            )
            return self._graph_initializer.compute_network_intelligence(graph, account_id)
        except Exception as e:
            print(f"Network intelligence build failed for {account_id}, falling back to single-node graph: {e}")
            return {
                "nodes": [{"id": account_id, "type": "mule" if risk_score > 600 else "normal"}],
                "edges": [],
            }

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
            # refiner/model were only ever trained on the important_features
            # set (the bank's 18, plus F3800/F3801 when
            # BOIDataRefiner.use_amount_totals is enabled - see cleaner.py).
            # Passing the FULL raw row here means clean_dataframe() hits
            # columns like random F-codes that were never seen during
            # training and have no fitted encoder - which crashed with
            # "No fitted encoder found for 'F3886'" and silently fell back
            # to the simulator. Subsetting to the trained columns (same
            # ones the model actually uses) fixes this and is also more
            # efficient.
            trained_cols = [c for c in self.refiner.important_features if c in raw_row.columns]
            feature_row = raw_row[trained_cols].copy()
            cleaned = self.refiner.clean_dataframe(feature_row, is_training=False)

            features = self.factory.engineer_features(cleaned, is_training=False)
            if 'F3924' in features.columns:
                features = features.drop(columns=['F3924'])

            # Align feature column order to exact expected order of trained ensemble model
            expected_cols = None
            if hasattr(self.ensemble.xgb_model, "feature_names_in_"):
                expected_cols = list(self.ensemble.xgb_model.feature_names_in_)
            elif hasattr(self.ensemble, "feature_names"):
                expected_cols = list(self.ensemble.feature_names)

            if expected_cols:
                for col in expected_cols:
                    if col not in features.columns:
                        features[col] = 0.0
                features = features[expected_cols]

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

            shap_explanation = self._explain(account_id, features, risk_score)
            damage_metrics = self._estimate_damage(raw_row, proba)
            network_connections = self._build_network_connections(account_id, raw_row, risk_score)

            return {
                "account_id": account_id,
                "risk_score": risk_score,
                "risk_level": level,
                "kill_chain_stage": stage,
                "damage_metrics": damage_metrics,
                "shap_explanation": shap_explanation,
                "network_connections": network_connections,
                # This result came from the real trained ensemble against a
                # matched dataset row - never the fallback simulator.
                "is_simulated": False,
            }
        except Exception as e:
            print(f"Real inference failed for {account_id}, falling back to simulator: {e}")
            return None

    def _estimate_damage(self, raw_row: pd.DataFrame, proba: float) -> dict:
        """
        Derives financial exposure estimates from the account's actual 31-day
        transaction credit/debit totals (F3800 credit inflow, F3801 debit outflow)
        scaled by the model's predicted risk probability.
        """
        inflow = float(raw_row[_INFLOW_COL].iloc[0]) if _INFLOW_COL in raw_row.columns and pd.notna(raw_row[_INFLOW_COL].iloc[0]) else 0.0
        cash_out = float(raw_row[_CASH_OUT_COL].iloc[0]) if _CASH_OUT_COL in raw_row.columns and pd.notna(raw_row[_CASH_OUT_COL].iloc[0]) else 0.0

        # In transit: proportion of cash debit outflow moving through channels
        in_transit_amount = round(cash_out * proba, 2)

        # Net remaining balance available for immediate freeze/recovery
        net_balance = max(inflow - cash_out, 0.0)
        if net_balance == 0.0 and inflow > 0.0:
            # Fallback estimation for rapid pass-through accounts: ~12% of credit inflow retained
            net_balance = inflow * 0.12

        recoverable_amount = round(net_balance * proba, 2)

        return {
            "recoverable_amount": recoverable_amount,
            "in_transit_amount": in_transit_amount,
            "is_estimated": True,
            "estimation_note": (
                "Derived from 31-day credit/debit transaction volumes (F3800/F3801) "
                "and model risk probability."
            ),
        }

    def _explain(self, account_id: str, features: pd.DataFrame, predicted_score: float) -> list:
        """Delegates SHAP explainability to ShapExplainerService if available,
        else an empty list rather than fabricated numbers."""
        if self.explainer_service is None:
            return []
        try:
            feature_row = features.iloc[0]
            explanation = self.explainer_service.explain_account(
                account_id=account_id,
                feature_row=feature_row,
                predicted_score=float(predicted_score),
            )
            return [
                {
                    "feature": c.display_name,
                    "contribution": c.shap_value,
                }
                for c in explanation.top_contributions
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

        # Deterministic noise based on character codes of account_id
        seed_val = sum(ord(char) * (idx + 1) for idx, char in enumerate(account_id))
        noise = (seed_val % 101) - 50  # integer between -50 and 50
        risk_score = int(min(base_risk + noise, 1000))

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

        # Deterministic destination ID
        dest_num = 10000 + (seed_val % 90000)
        dest_id = f"BOI-{dest_num}"

        # Deterministic SHAP contributions
        sudden_activation = round(0.1 + ((seed_val % 31) / 100.0), 2)  # 0.10 to 0.40
        narrow_network = round(0.05 + ((seed_val % 16) / 100.0), 2)     # 0.05 to 0.20

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
                {"feature": "sudden_activation", "contribution": sudden_activation},
                {"feature": "narrow_network", "contribution": narrow_network}
            ],
            "network_connections": {
                "nodes": [
                    {"id": account_id, "type": "mule"},
                    {"id": dest_id, "type": "cash_out"}
                ],
                "edges": [
                    {"source": account_id, "target": dest_id, "amount": round(in_transit * 0.8, 2)}
                ]
            },
            # This result did NOT come from the trained ensemble - either
            # no model artifacts exist yet, or account_id had no matching
            # row in the source dataset. The frontend must never present
            # this as a verified prediction.
            "is_simulated": True,
        }

    # ------------------------------------------------------------------
    # Public entrypoint
    # ------------------------------------------------------------------
    def evaluate_account(self, account_id: str) -> Optional[dict]:
        if self.ensemble is not None:
            raw_row = self._get_account_row(account_id)
            if raw_row is not None:
                return self._run_real_inference(account_id, raw_row)
        return None

    def get_accounts(self, limit: int = 50) -> list:
        df = self._load_dataset()
        if df is None or 'account_id' not in df.columns:
            return []
        account_ids = df['account_id'].head(limit).tolist()
        results = []
        for ac_id in account_ids:
            res = self.evaluate_account(ac_id)
            if res is not None:
                results.append(res)
        return results