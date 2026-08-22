"""
MuleRadar Backend API — Complete Rewrite
=========================================
FastAPI server with:
  - Pre-computed score cache (instant responses, like SHIELD)
  - Session auth (login/logout)
  - Audit trail (freeze/escalate/dismiss)
  - CSV validation endpoint
  - Rich paginated/filterable/sortable accounts API
  - Metrics/model monitor
  - AI Copilot summaries
"""

import io
import logging
import sys
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, UploadFile, File, Query, status
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

# --- PATH RESOLUTION ---
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR))

from ml_pipeline.analyzer import MuleRiskAnalyzer
from app.schemas.models import RiskEvaluationResponse, CopilotResponse, BatchEvaluationRequest
from app.core.config import get_settings

settings = get_settings()

# --- SERVICES ---
from app.services.copilot import AIInvestigator
from app.services.audit import audit_trail, ActionRequest, ActionRecord
from app.services.auth import (
    login as auth_login, logout as auth_logout, validate_token,
    LoginRequest, LoginResponse, SessionUser,
)
from app.services.score_cache import score_cache

# ---------------------------------------------------------
# LOGGING
# ---------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("muleradar")

# ---------------------------------------------------------
# APP
# ---------------------------------------------------------
app = FastAPI(
    title="MuleRadar API",
    description="AI Money Mule Detection & Financial Risk Intelligence Platform — Bank of India Hackathon 2026",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins if hasattr(settings, 'allowed_origins') else ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# STARTUP: Initialize engines + pre-compute scores
# ---------------------------------------------------------
analyzer_engine = MuleRiskAnalyzer()
copilot_service = AIInvestigator()

logger.info(f"ML engine: {analyzer_engine.engine_status}")

# Pre-compute all account scores at startup (like SHIELD does)
score_cache.build(analyzer_engine)
logger.info(f"Score cache ready: {score_cache.total_accounts} accounts")


# ---------------------------------------------------------
# AUTH HELPERS
# ---------------------------------------------------------
async def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if not settings.API_KEY:
        return
    if x_api_key != settings.API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")


def _get_user(auth: Optional[str]) -> Optional[SessionUser]:
    return validate_token(auth)


# ---------------------------------------------------------
# AUTH ENDPOINTS
# ---------------------------------------------------------
@app.post("/api/v1/auth/login", response_model=LoginResponse)
def login(req: LoginRequest):
    """Login. Demo: analyst/mule123 or admin/mule123"""
    result = auth_login(req.username, req.password)
    if result is None:
        raise HTTPException(401, "Invalid username or password")
    return result


@app.post("/api/v1/auth/logout")
def logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        auth_logout(authorization.removeprefix("Bearer ").strip())
    return {"ok": True}


@app.get("/api/v1/auth/me", response_model=SessionUser)
def get_me(authorization: Optional[str] = Header(default=None)):
    user = _get_user(authorization)
    if not user:
        raise HTTPException(401, "Invalid or expired session token")
    return user


# ---------------------------------------------------------
# HEALTH
# ---------------------------------------------------------
@app.get("/")
def read_root():
    return {"status": "online", "service": "MuleRadar API", "version": "2.0.0"}


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "engine": analyzer_engine.engine_status,
        "cache_ready": score_cache.is_ready,
        "accounts_cached": score_cache.total_accounts,
        "models_loaded": ["xgb", "lgbm", "catboost", "isolation_forest", "meta_learner"],
    }


# ---------------------------------------------------------
# SINGLE ACCOUNT EVALUATION (instant from cache, or live fallback)
# ---------------------------------------------------------
@app.post("/api/v1/evaluate/{account_id}", dependencies=[Depends(verify_api_key)])
async def evaluate_account(account_id: str):
    """Evaluate a single account. Served from pre-computed cache (instant)."""
    # Try cache first (instant)
    cached = score_cache.get_account(account_id)
    if cached is not None:
        return cached

    # Fallback: live inference (slower, but handles accounts not in cache)
    result = await run_in_threadpool(analyzer_engine.evaluate_account, account_id)
    if result is None:
        raise HTTPException(404, f"Account '{account_id}' not found in dataset.")
    return result


# ---------------------------------------------------------
# BATCH EVALUATION
# ---------------------------------------------------------
@app.post("/api/v1/evaluate/batch/", dependencies=[Depends(verify_api_key)])
async def evaluate_batch(request: BatchEvaluationRequest):
    """Evaluate multiple accounts at once."""
    results = []
    for account_id in request.account_ids:
        cached = score_cache.get_account(account_id)
        if cached is not None:
            results.append(cached)
        else:
            result = await run_in_threadpool(analyzer_engine.evaluate_account, account_id)
            if result is not None:
                results.append(result)
    if not results:
        raise HTTPException(404, "None of the requested accounts were found.")
    return results


# ---------------------------------------------------------
# ACCOUNTS LIST — Paginated, Filterable, Sortable (like SHIELD)
# ---------------------------------------------------------
@app.get("/api/v1/accounts", dependencies=[Depends(verify_api_key)])
async def get_accounts(
    search: Optional[str] = Query(None, description="Search account ID substring"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level"),
    min_score: int = Query(0, ge=0, le=1000),
    max_score: int = Query(1000, ge=0, le=1000),
    flagged_only: bool = Query(False),
    sort_by: str = Query("risk_score", pattern="^(risk_score|account_id|risk_level|recoverable_amount|in_transit_amount)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
):
    """
    Get paginated, filterable, sortable list of scored accounts.
    Instant from pre-computed cache.
    """
    return score_cache.get_accounts(
        search=search,
        risk_level=risk_level,
        min_score=min_score,
        max_score=max_score,
        flagged_only=flagged_only,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------
# FILTER OPTIONS (for dropdown menus in frontend)
# ---------------------------------------------------------
@app.get("/api/v1/filters", dependencies=[Depends(verify_api_key)])
def get_filter_options():
    """Distinct values for filter dropdowns."""
    return score_cache.get_filter_options()


# ---------------------------------------------------------
# CASE ACTION + AUDIT TRAIL
# ---------------------------------------------------------
@app.post("/api/v1/accounts/{account_id}/action", response_model=ActionRecord)
async def take_action(
    account_id: str,
    req: ActionRequest,
    authorization: Optional[str] = Header(default=None),
):
    """
    Compliance action: freeze / escalate / dismiss / unfreeze.
    Logged to audit trail with analyst attribution.
    """
    user = _get_user(authorization)
    analyst_name = user.display_name if user else req.analyst

    # Get risk score for audit context
    risk_score = None
    cached = score_cache.get_account(account_id)
    if cached:
        risk_score = cached.get("risk_score")

    record = audit_trail.record_action(
        account_id=account_id,
        action=req.action,
        analyst=analyst_name,
        note=req.note or "",
        risk_score=risk_score,
    )
    logger.info(f"Action: {req.action} on {account_id} by {analyst_name}")
    return record


@app.get("/api/v1/audit-trail")
def get_audit_trail(account_id: Optional[str] = None, limit: int = 100):
    """Audit trail history."""
    return audit_trail.get_trail(account_id=account_id, limit=limit)


@app.get("/api/v1/accounts/{account_id}/status")
def get_account_status(account_id: str):
    """Current compliance status of an account."""
    status_val = audit_trail.get_account_status(account_id)
    latest = audit_trail.get_latest_action(account_id)
    return {"account_id": account_id, "status": status_val, "last_action": latest}


# ---------------------------------------------------------
# METRICS / MODEL MONITOR
# ---------------------------------------------------------
@app.get("/api/v1/metrics")
def get_metrics():
    """Portfolio KPIs, score distribution, model architecture."""
    return score_cache.get_metrics()


# ---------------------------------------------------------
# VALIDATE (score uploaded CSV)
# ---------------------------------------------------------
@app.post("/api/v1/validate")
async def validate_dataset(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    """
    Score an uploaded CSV with the trained model.
    Each row is evaluated as an account.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Please upload a .csv file")

    raw = await file.read()
    if len(raw) > 250 * 1024 * 1024:
        raise HTTPException(413, "File too large (250MB limit)")

    try:
        import pandas as pd
        df = pd.read_csv(io.BytesIO(raw), low_memory=False)
    except Exception as e:
        raise HTTPException(400, f"Could not parse CSV: {e}")

    if df.empty:
        raise HTTPException(400, "Uploaded file has no rows")

    # Find account IDs
    id_col = None
    for candidate in ["account_id", "Unnamed: 0", "id", "Account_ID"]:
        if candidate in df.columns:
            id_col = candidate
            break

    warnings = []
    if id_col is None:
        account_ids = [str(i) for i in range(min(len(df), 500))]
        warnings.append("No account_id column found. Using row index.")
    else:
        account_ids = df[id_col].astype(str).tolist()[:500]

    results = []
    for acct_id in account_ids:
        # Try cache first
        cached = score_cache.get_account(acct_id)
        if cached is not None:
            results.append({
                "account_id": cached.get("account_id", acct_id),
                "risk_score": cached.get("risk_score", 0),
                "risk_level": cached.get("risk_level", "Unknown"),
                "kill_chain_stage": cached.get("kill_chain_stage", "None"),
            })
        else:
            try:
                report = await run_in_threadpool(analyzer_engine.evaluate_account, acct_id)
                if report is not None:
                    results.append({
                        "account_id": report.get("account_id", acct_id),
                        "risk_score": report.get("risk_score", 0),
                        "risk_level": report.get("risk_level", "Unknown"),
                        "kill_chain_stage": report.get("kill_chain_stage", "None"),
                    })
            except Exception:
                pass

    return {
        "n_rows": len(account_ids),
        "n_scored": len(results),
        "results": results,
        "warnings": warnings,
    }


# ---------------------------------------------------------
# AI COPILOT
# ---------------------------------------------------------
@app.get("/api/v1/copilot/summarize/{account_id}", dependencies=[Depends(verify_api_key)])
async def summarize_account(account_id: str):
    """GenAI natural language summary of risk intelligence."""
    cached = score_cache.get_account(account_id)
    report = cached if cached else await run_in_threadpool(analyzer_engine.evaluate_account, account_id)
    if report is None:
        raise HTTPException(404, f"Account '{account_id}' not found.")
    summary = await copilot_service.generate_summary(report)
    return CopilotResponse(account_id=account_id, summary=summary)


# ---------------------------------------------------------
# RUN
# ---------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
