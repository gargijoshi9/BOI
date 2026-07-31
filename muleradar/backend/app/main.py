import logging
import os
import sys
from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

# --- PATH RESOLUTION ---
# This finds the root 'muleradar' folder so we can securely import 'ml_pipeline'
# __file__ represents main.py -> app/ -> backend/ -> muleradar/
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR))

# Import the ML Engine from the parallel folder
from ml_pipeline.analyzer import MuleRiskAnalyzer

# Import Pydantic schemas
from app.schemas.models import (
    RiskEvaluationResponse,
    CopilotResponse,
    BatchEvaluationRequest
)

# ---------------------------------------------------------
# LOGGING
# ---------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("muleradar")

# ---------------------------------------------------------
# CONFIG (env-driven for now; centralized into app/core/config.py
# with pydantic-settings on Day 3 - kept as plain os.getenv here so
# that migration is a drop-in replacement, not another rewrite)
# ---------------------------------------------------------
_RAW_ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
ALLOWED_ORIGINS: List[str] = [o.strip() for o in _RAW_ALLOWED_ORIGINS.split(",") if o.strip()]

API_KEY = os.getenv("API_KEY", "").strip()
if not API_KEY:
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

# CORS: explicit allowlist only. allow_credentials is left False since
# nothing in this app relies on cookies - a wildcard origin combined with
# allow_credentials=True is both a security anti-pattern and invalid per
# the CORS spec (browsers reject credentialed wildcard-origin requests).
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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
logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")


# ---------------------------------------------------------
# AUTH DEPENDENCY
# ---------------------------------------------------------
async def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """
    Minimal API key gate. If API_KEY is unset in the environment, this
    is a no-op (see the startup warning above) so local development
    stays frictionless. Once API_KEY is set, every protected request
    must include a matching X-API-Key header or gets a 401.
    """
    if not API_KEY:
        return
    if x_api_key != API_KEY:
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

@app.post(
    "/api/v1/evaluate/{account_id}",
    response_model=RiskEvaluationResponse,
    dependencies=[Depends(verify_api_key)],
)
def evaluate_account(account_id: str):
    """
    Evaluates a single account ID against the detection pipeline.
    Returns structured risk metrics, network routing graphs, and explainable AI insights.
    """
    # Ask the ML engine to calculate the dynamic risk for this specific account
    intelligence_report = analyzer_engine.evaluate_account(account_id)

    # Audit trail: every evaluation gets logged with enough context to
    # reconstruct who/what was checked and whether the result was real or
    # simulated - important for an AML tool where query history itself
    # can matter for compliance review.
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
def evaluate_batch(request: BatchEvaluationRequest):
    """
    Evaluates a list of account IDs against the detection pipeline.
    Returns a list of structured risk intelligence reports.
    """
    results = []
    for account_id in request.account_ids:
        intelligence_report = analyzer_engine.evaluate_account(account_id)
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
def get_accounts(limit: int = 25):
    """
    Returns a list of accounts from the dataset, evaluated against the detection pipeline.
    """
    return analyzer_engine.get_accounts(limit)

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
    report = analyzer_engine.evaluate_account(account_id)
    summary = await copilot_service.generate_summary(report)
    logger.info("summarize_account | account_id=%s", account_id)
    return CopilotResponse(account_id=account_id, summary=summary)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)