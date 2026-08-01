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
    return await run_in_threadpool(analyzer_engine.get_accounts, limit)

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