"""
MuleRadar Score Cache — Pre-compute ALL accounts at startup
============================================================

This is what makes SHIELD's backend feel fast: they pre-score every
account at training time and serve from memory. We do the same, but
with our superior ML pipeline (real labels, stacked ensemble, SHAP,
graph intelligence, damage metrics).

At startup:
  1. Load the trained model artifacts
  2. Load the raw dataset
  3. Score EVERY account through the real inference pipeline
  4. Cache results in a DataFrame for instant API serving

This gives us:
  - Instant /api/v1/accounts with filter/sort/pagination
  - Instant /api/v1/accounts/{id} with full detail
  - Instant /api/v1/metrics with portfolio KPIs
  - No per-request inference latency
"""

import time
import numpy as np
import pandas as pd
from typing import Optional, Dict, List, Any
from pathlib import Path


class ScoreCache:
    """
    Pre-computed'X and serves all account evaluations from memory.
    Built once at startup, then read-only for all API requests.
    """

    def __init__(self):
        self._scored_df: Optional[pd.DataFrame] = None
        self._by_id: Dict[str, dict] = {}
        self._shap_cache: Dict[str, list] = {}
        self._network_cache: Dict[str, dict] = {}
        self._build_time: float = 0.0
        self._engine_status: str = "Not initialized"
        self._analyzer = None

    def build(self, analyzer) -> None:
        """
        Score all accounts through the real ML pipeline and cache results.
        Called once at backend startup.
        """
        self._analyzer = analyzer
        self._engine_status = analyzer.engine_status
        t0 = time.time()

        # Load the dataset
        df = analyzer._load_dataset()
        if df is None or 'account_id' not in df.columns:
            print("  ScoreCache: No dataset available, cache empty")
            return

        account_ids = df['account_id'].astype(str).tolist()
        total = len(account_ids)
        print(f"  ScoreCache: Pre-scoring {total} accounts...")

        records = []
        scored = 0
        failed = 0

        for i, acct_id in enumerate(account_ids):
            if (i + 1) % 1000 == 0:
                print(f"    Progress: {i+1}/{total} ({(i+1)/total*100:.0f}%)")

            try:
                result = analyzer.evaluate_account(acct_id)
                if result is not None:
                    self._by_id[acct_id] = result
                    records.append(self._flatten(result))
                    scored += 1
                else:
                    failed += 1
            except Exception as e:
                failed += 1

        if records:
            self._scored_df = pd.DataFrame(records)

        elapsed = time.time() - t0
        print(f"  ScoreCache: {scored} accounts scored, {failed} failed, in {elapsed:.1f}s")
        self._build_time = elapsed

    def _flatten(self, result: dict) -> dict:
        """Flatten a result dict into a flat row for the DataFrame."""
        row = {
            'account_id': result.get('account_id', ''),
            'risk_score': result.get('risk_score', 0),
            'risk_level': result.get('risk_level', 'Unknown'),
            'kill_chain_stage': result.get('kill_chain_stage', 'None'),
            'is_simulated': result.get('is_simulated', True),
        }

        # Damage metrics
        dmg = result.get('damage_metrics', {})
        row['recoverable_amount'] = dmg.get('recoverable_amount', 0)
        row['in_transit_amount'] = dmg.get('in_transit_amount', 0)
        row['total_exposure'] = row['recoverable_amount'] + row['in_transit_amount']

        # Network stats
        net = result.get('network_connections', {})
        row['network_nodes'] = len(net.get('nodes', []))
        row['network_edges'] = len(net.get('edges', []))

        # Top SHAP feature (for table preview)
        shap = result.get('shap_explanation', [])
        if shap:
            row['top_factor'] = shap[0].get('feature', '')
            row['top_factor_value'] = shap[0].get('contribution', 0)
        else:
            row['top_factor'] = ''
            row['top_factor_value'] = 0

        return row

    # ------------------------------------------------------------------
    # Query=public API — all instant, served from memory
    # ------------------------------------------------------------------

    def get_account(self, account_id: str) -> Optional[dict]:
        """Get full evaluation for a single account. Instant lookup."""
        return self._by_id.get(str(account_id))

    def get_accounts(
        self,
        search: Optional[str] = None,
        risk_level: Optional[str] = None,
        min_score: int = 0,
        max_score: int = 1000,
        flagged_only: bool = False,
        sort_by: str = 'risk_score',
        sort_dir: str = 'desc',
        page: int = 1,
        page_size: int = 25,
    ) -> dict:
        """
        Get paginated, filtered, sorted accounts. Instant from cache.

        Returns: {"total", "page", "page_size", "results"}
        """
        if self._scored_df is None:
            return {"total": 0, "page": page, "page_size": page_size, "results": []}

        df = self._scored_df.copy()

        # Filters
        if search:
            df = df[df['account_id'].astype(str).str.contains(search, na=False)]
        if risk_level and risk_level != 'ALL':
            df = df[df['risk_level'] == risk_level]
        df = df[(df['risk_score'] >= min_score) & (df['risk_score'] <= max_score)]
        if flagged_only:
            df = df[df['risk_score'] >= 600]

        # Sort
        ascending = sort_dir == 'asc'
        if sort_by in df.columns:
            df = df.sort_values(sort_by, ascending=ascending)

        total = len(df)
        start = (page - 1) * page_size
        page_df = df.iloc[start:start + page_size]

        results = page_df.to_dict('records')
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "results": results,
        }

    def get_metrics(self) -> dict:
        """Portfolio KPIs and score distribution. Instant from cache."""
        if self._scored_df is None:
            return {"total_accounts": 0, "engine_status": self._engine_status}

        df = self._scored_df
        scores = df['risk_score']

        buckets = {
            "low (0-400)": int(((scores >= 0) & (scores < 401)).sum()),
            "medium (401-600)": int(((scores >= 401) & (scores < 601)).sum()),
            "high (601-800)": int(((scores >= 601) & (scores < 801)).sum()),
            "critical (801-1000)": int((scores >= 801).sum()),
        }

        flagged = int((scores >= 600).sum())
        total = len(df)

        return {
            "total_accounts": total,
            "flagged_count": flagged,
            "flagged_pct": round(flagged / max(total, 1) * 100, 2),
            "score_buckets": buckets,
            "engine_status": self._engine_status,
            "cache_build_time": round(self._build_time, 1),
            "avg_risk_score": round(float(scores.mean()), 1),
            "max_risk_score": int(scores.max()),
            "model_info": {
                "models": ["XGBoost", "LightGBM", "CatBoost", "IsolationForest", "Meta-Learner"],
                "feature_selection": "4-stage funnel (Variance→Correlation→Gain→Force-include)",
                "train_test_split": "Out-of-time on F2230",
                "labels": "Real mule labels (F3924) — NOT pseudo-labels",
            },
        }

    def get_filter_options(self) -> dict:
        """Distinct values for filter dropdowns."""
        if self._scored_df is None:
            return {"risk_levels": [], "account_ids": []}

        df = self._scored_df
        return {
            "risk_levels": sorted(df['risk_level'].unique().tolist()),
            "account_ids_sample": df['account_id'].astype(str).head(20).tolist(),
        }

    @property
    def is_ready(self) -> bool:
        return self._scored_df is not None and len(self._scored_df) > 0

    @property
    def total_accounts(self) -> int:
        return len(self._scored_df) if self._scored_df is not None else 0


# Global instance
score_cache = ScoreCache()
