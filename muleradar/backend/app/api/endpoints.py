import io
import re
import pandas as pd
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File

from app.schemas.models import (
    RiskEvaluationResponse, ValidationResponse, ValidationWarnings,
    ReviewQueueResponse, ReviewQueueItem, ReviewDecisionRequest, ReviewDecisionRecord
)
from app.services.analyzer import mule_analyzer
from app.services import audit_trail

router = APIRouter()

@router.get("/accounts", response_model=List[RiskEvaluationResponse])
async def get_all_accounts(limit: Optional[int] = None, held_out_only: bool = True):
    try:
        return mule_analyzer.get_accounts(limit=limit, held_out_only=held_out_only)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/evaluate/{account_id}", response_model=RiskEvaluationResponse)
@router.post("/evaluate/{account_id}", response_model=RiskEvaluationResponse)
async def evaluate_account(account_id: str):
    try:
        result = mule_analyzer.evaluate_account(account_id)
        if not result:
            raise HTTPException(status_code=404, detail="Account not found and simulator failed.")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/validate", response_model=ValidationResponse)
async def validate_dataset(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents), low_memory=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading CSV: {str(e)}")

    if mule_analyzer.artifact is None:
        raise HTTPException(status_code=503, detail="Trained model artifact not loaded.")

    if 'Unnamed: 0' in df.columns and 'account_id' not in df.columns:
        df = df.rename(columns={'Unnamed: 0': 'account_id'})
    
    df.columns = [
        'account_id' if c == 'account_id' else re.sub(r'[\[\]{} ,:]', '_', c)
        for c in df.columns
    ]

    expected_features = set(mule_analyzer.final_features)
    provided_columns = set(df.columns)
    
    missing_columns = list(expected_features - provided_columns)
    extra_columns_ignored = len(provided_columns - expected_features)
    
    if 'account_id' not in df.columns:
        df['account_id'] = [f"UPLOADED-{i}" for i in range(len(df))]
    df['account_id'] = df['account_id'].astype(str)

    results = mule_analyzer._run_batch_inference(df) 
    
    disclaimer = (
        "CONFIDENCE METRICS: Model evaluated using a rigorously split, non-circular "
        "Hold-Out Test Set. Data dictionary mapping was applied to verify behavioral metrics. "
        "NOTE: Suspected timestamp proxy (F2230) and post-event administrative frozen-account "
        "flags were explicitly purged to prevent data leakage and ensure real-world applicability."
    )

    return ValidationResponse(
        filename=file.filename,
        n_rows=len(df),
        warnings=ValidationWarnings(
            missing_columns=missing_columns,
            extra_columns_ignored=extra_columns_ignored
        ),
        methodology_note=disclaimer,
        results=results
    )

# ==========================================
# HITL REVIEW QUEUE ENDPOINTS
# ==========================================

@router.get("/review-queue", response_model=ReviewQueueResponse)
async def get_review_queue(limit: int = 100, held_out_only: bool = True):
    try:
        # Run batch inference to find accounts needing review
        accounts = mule_analyzer.get_accounts(limit=None, held_out_only=held_out_only)
        
        # Exclude accounts that have already been adjudicated in the audit trail
        resolved_records = audit_trail.get_trail()
        resolved_ids = {r["account_id"] for r in resolved_records}

        queue_items = []
        for a in accounts:
            hr = a.get("human_review", {})
            if hr.get("requires_review") and a["account_id"] not in resolved_ids:
                queue_items.append(
                    ReviewQueueItem(
                        account_id=a["account_id"],
                        risk_score=a["risk_score"],
                        risk_level=a["risk_level"],
                        review_reason=hr.get("review_reason"),
                        queued_at=datetime.utcnow().isoformat()
                    )
                )
        
        queue_items = queue_items[:limit]
        return {"total": len(queue_items), "items": queue_items}
    except Exception as e:
        import traceback
        traceback.print_exc() # Prints exact error to terminal
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/review-queue/{account_id}/resolve", response_model=ReviewDecisionRecord)
async def resolve_review(account_id: str, req: ReviewDecisionRequest):
    try:
        if req.decision not in ("confirm_mule", "clear", "escalate"):
            raise HTTPException(status_code=400, detail="Invalid decision")

        report = mule_analyzer.evaluate_account(account_id)
        if not report:
            raise HTTPException(status_code=404, detail="Account not found")

        # Save to the JSON audit trail
        record = audit_trail.record_decision({
            "account_id": account_id,
            "decision": req.decision,
            "reviewer_name": req.reviewer_name,
            "note": req.note or "",
            "model_risk_score": report.get("risk_score", 0),
            "model_review_reason": report.get("human_review", {}).get("review_reason"),
        })
        return record
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/review-queue/audit-trail", response_model=List[ReviewDecisionRecord])
async def get_audit_trail(account_id: Optional[str] = None):
    try:
        return audit_trail.get_trail(account_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))