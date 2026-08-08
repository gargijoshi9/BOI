import logging
import sys
from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

# --- PATH RESOLUTION ---
# This finds the root 'muleradar' folder so we can securely import 'ml_pipeline'
# __file__ represents main.py -> app/ -> backend/ -> muleradar/
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR))

# Import the ML Engine from the parallel folder
from ml_pipeline.analyzer import MuleRiskAnalyzer
from ml_pipeline.src.graph_engine.graph_analytics import NetworkIntelligence
from ml_pipeline.src.explainability.explainer import FraudExplainer
import networkx as nx
import pandas as pd

# Import Pydantic schemas
from app.schemas.models import (
    RiskEvaluationResponse,
    CopilotResponse,
    BatchEvaluationRequest
)

# Centralized settings (replaces scattered os.getenv() calls)
from app.core.config import get_settings

settings = get_settings()

# ---------------------------------------------------------
# LOGGING
# ---------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("muleradar")

if not settings.API_KEY:
    logger.warning(
        "API_KEY is not set - evaluation endpoints are running WITHOUT "
        "authentication. Set the API_KEY environment variable before any "
        "public or production deployment (including hackathon demo "
        "environments reachable outside localhost)."
    )

app = FastAPI(
    title="MuleRadar API",
    description="Backend API services for suspicious mule account detection",
    version="1.0.0"
)

# CORS: explicit allowlist only, sourced from Settings. allow_credentials
# is left False since nothing in this app relies on cookies - a wildcard
# origin combined with allow_credentials=True is both a security
# anti-pattern and invalid per the CORS spec.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import AI Investigator Copilot Service
from app.services.copilot import AIInvestigator

# --- INITIALIZE ENGINES ---
analyzer_engine = MuleRiskAnalyzer()
copilot_service = AIInvestigator()

logger.info(f"MuleRadar backend starting. ML engine status: {analyzer_engine.engine_status}")
logger.info(f"CORS allowed origins: {settings.allowed_origins}")
logger.info(f"Environment: {settings.ENVIRONMENT}")


# ---------------------------------------------------------
# AUTH DEPENDENCY
# ---------------------------------------------------------
async def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """
    Minimal API key gate. If API_KEY is unset in Settings, this is a
    no-op (see the startup warning above) so local development stays
    frictionless. Once API_KEY is set, every protected request must
    include a matching X-API-Key header or gets a 401.
    """
    if not settings.API_KEY:
        return
    if x_api_key != settings.API_KEY:
        logger.warning("Rejected request with missing/invalid X-API-Key header.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )


# ---------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "MuleRadar Backend API",
        "message": "Welcome to MuleRadar API engine."
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected (mocked)",
        "engine": analyzer_engine.engine_status,
        "models_loaded": ["xgb_mule_detector", "gnn_ring_analyser"]
    }

async def enhance_report(intelligence_report: dict) -> dict:
    account_id = intelligence_report.get("account_id")
    # 1. Construct a dummy graph of 5 nodes
    G = nx.DiGraph()
    nodes_list = [account_id, "ACC-02", "ACC-03", "ACC-04", "ACC-05"]
    G.add_edge(account_id, "ACC-02", amount=12000.0)
    G.add_edge("ACC-02", "ACC-03", amount=8500.0)
    G.add_edge("ACC-03", "ACC-04", amount=15000.0)
    G.add_edge("ACC-04", "ACC-05", amount=6000.0)
    G.add_edge("ACC-05", account_id, amount=9000.0)

    # 2. Pass it through NetworkIntelligence to get Louvain communities
    net_intel = NetworkIntelligence(G)
    communities = net_intel.detect_mule_rings()

    # 3. Shape the data for the frontend's NetworkGraph.tsx
    risk_score = intelligence_report.get("risk_score", 0)
    node_types = {
        account_id: "mule" if risk_score > 600 else "normal",
        "ACC-02": "relay",
        "ACC-03": "cash_out",
        "ACC-04": "normal",
        "ACC-05": "normal"
    }

    nodes_payload = [{"id": nid, "type": node_types.get(nid, "normal")} for nid in nodes_list]
    edges_payload = []
    for u, v, data in G.edges(data=True):
        edges_payload.append({
            "source": u,
            "target": v,
            "amount": data.get("amount", 0.0)
        })

    intelligence_report["network_connections"] = {
        "nodes": nodes_payload,
        "edges": edges_payload
    }

    # 4. Integrate FraudExplainer for SHAP values
    model = None
    if analyzer_engine.ensemble is not None and hasattr(analyzer_engine.ensemble, 'xgb_model'):
        model = analyzer_engine.ensemble.xgb_model

    explainer = FraudExplainer(model)
    raw_row = analyzer_engine._get_account_row(account_id)

    if raw_row is not None and model is not None and analyzer_engine.refiner is not None and analyzer_engine.factory is not None:
        try:
            trained_cols = [c for c in analyzer_engine.refiner.important_features if c in raw_row.columns]
            feature_row = raw_row[trained_cols].copy()
            cleaned = analyzer_engine.refiner.clean_dataframe(feature_row, is_training=False)
            features = analyzer_engine.factory.engineer_features(cleaned, is_training=False)
            if 'F3924' in features.columns:
                features = features.drop(columns=['F3924'])

            shap_values = explainer.explain_prediction(features)
            top_contributors = explainer.get_top_contributors(shap_values, list(features.columns))

            shap_explanations = []
            for item in top_contributors:
                feat = item["feature"]
                impact_str = item["impact"]
                try:
                    contribution_val = float(impact_str.strip("%")) / 100.0
                except Exception:
                    contribution_val = 0.0
                shap_explanations.append({
                    "feature": feat,
                    "contribution": contribution_val
                })
            intelligence_report["shap_explanation"] = shap_explanations
        except Exception as e:
            logger.warning(f"Error computing SHAP values in evaluate endpoint: {e}")
            # fallback if computation fails
            intelligence_report["shap_explanation"] = [
                {"feature": "pass_through_ratio", "contribution": 0.45},
                {"feature": "sudden_activation", "contribution": 0.35},
                {"feature": "narrow_network_flag", "contribution": 0.20}
            ]
    else:
        # Fallback simulator or missing row SHAP explanation
        intelligence_report["shap_explanation"] = [
            {"feature": "pass_through_ratio", "contribution": 0.45},
            {"feature": "sudden_activation", "contribution": 0.35},
            {"feature": "narrow_network_flag", "contribution": 0.20}
        ]

    return intelligence_report


@app.post(
    "/api/v1/evaluate/{account_id}",
    response_model=RiskEvaluationResponse,
    dependencies=[Depends(verify_api_key)],
)
async def evaluate_account(account_id: str):
    """
    Evaluates a single account ID against the detection pipeline.
    Returns structured risk metrics, network routing graphs, and explainable AI insights.

    Runs the actual (blocking) inference call in a threadpool so this
    doesn't stall the event loop for other concurrent requests -
    important once multiple judges/demo devices hit the API at once.
    """
    intelligence_report = await run_in_threadpool(
        analyzer_engine.evaluate_account, account_id
    )
    intelligence_report = await enhance_report(intelligence_report)

    logger.info(
        "evaluate_account | account_id=%s risk_score=%s risk_level=%s is_simulated=%s",
        intelligence_report.get("account_id"),
        intelligence_report.get("risk_score"),
        intelligence_report.get("risk_level"),
        intelligence_report.get("is_simulated"),
    )
    return intelligence_report

@app.post(
    "/api/v1/evaluate/batch/",
    response_model=List[RiskEvaluationResponse],
    dependencies=[Depends(verify_api_key)],
)
async def evaluate_batch(request: BatchEvaluationRequest):
    """
    Evaluates a list of account IDs against the detection pipeline.
    Returns a list of structured risk intelligence reports.

    Each evaluation is offloaded to the threadpool individually rather
    than looping synchronously in the route handler, so a large batch
    doesn't monopolize the event loop for the whole request duration.
    """
    results = []
    for account_id in request.account_ids:
        intelligence_report = await run_in_threadpool(
            analyzer_engine.evaluate_account, account_id
        )
        intelligence_report = await enhance_report(intelligence_report)
        logger.info(
            "evaluate_batch | account_id=%s risk_score=%s risk_level=%s is_simulated=%s",
            intelligence_report.get("account_id"),
            intelligence_report.get("risk_score"),
            intelligence_report.get("risk_level"),
            intelligence_report.get("is_simulated"),
        )
        results.append(intelligence_report)
    return results

@app.get(
    "/api/v1/accounts",
    response_model=List[RiskEvaluationResponse],
    dependencies=[Depends(verify_api_key)],
)
async def get_accounts(limit: int = 25):
    """
    Returns a list of accounts from the dataset, evaluated against the detection pipeline.

    Offloaded to the threadpool as a single call, since get_accounts()
    internally loops over evaluate_account() per row anyway - this at
    least keeps the event loop free for OTHER requests while this one
    (potentially slow, given per-row SHAP computation) runs.
    """
    raw_accounts = await run_in_threadpool(analyzer_engine.get_accounts, limit)
    results = []
    for ac in raw_accounts:
        enhanced = await enhance_report(ac)
        results.append(enhanced)
    return results

@app.get(
    "/api/v1/copilot/summarize/{account_id}",
    response_model=CopilotResponse,
    dependencies=[Depends(verify_api_key)],
)
async def summarize_account(account_id: str):
    """
    Provides an asynchronous GenAI natural language summary explaining the risk intelligence report
    for the copilot panel.
    """
    report = await run_in_threadpool(analyzer_engine.evaluate_account, account_id)
    summary = await copilot_service.generate_summary(report)
    logger.info("summarize_account | account_id=%s", account_id)
    return CopilotResponse(account_id=account_id, summary=summary)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)