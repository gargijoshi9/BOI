import sys
from pathlib import Path
from typing import List

# --- PATH RESOLUTION ---
# This finds the root 'muleradar' folder so we can securely import 'ml_pipeline'
# __file__ represents main.py -> app/ -> backend/ -> muleradar/
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import the ML Engine from the parallel folder
from ml_pipeline.analyzer import MuleRiskAnalyzer

# Import Pydantic schemas
from app.schemas.models import (
    RiskEvaluationResponse,
    CopilotResponse,
    BatchEvaluationRequest
)

app = FastAPI(
    title="MuleRadar API",
    description="Backend API services for suspicious mule account detection",
    version="1.0.0"
)

# CORS middleware config to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production environments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import AI Investigator Copilot Service
from app.services.copilot import AIInvestigator

# --- INITIALIZE ENGINES ---
analyzer_engine = MuleRiskAnalyzer()
copilot_service = AIInvestigator()

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

@app.post("/api/v1/evaluate/{account_id}", response_model=RiskEvaluationResponse)
def evaluate_account(account_id: str):
    """
    Evaluates a single account ID against the detection pipeline.
    Returns structured risk metrics, network routing graphs, and explainable AI insights.
    """
    # Ask the ML engine to calculate the dynamic risk for this specific account
    intelligence_report = analyzer_engine.evaluate_account(account_id)
    return intelligence_report

@app.post("/api/v1/evaluate/batch/", response_model=List[RiskEvaluationResponse])
def evaluate_batch(request: BatchEvaluationRequest):
    """
    Evaluates a list of account IDs against the detection pipeline.
    Returns a list of structured risk intelligence reports.
    """
    results = []
    for account_id in request.account_ids:
        intelligence_report = analyzer_engine.evaluate_account(account_id)
        results.append(intelligence_report)
    return results

@app.get("/api/v1/copilot/summarize/{account_id}", response_model=CopilotResponse)
async def summarize_account(account_id: str):
    """
    Provides an asynchronous GenAI natural language summary explaining the risk intelligence report
    for the copilot panel.
    """
    report = analyzer_engine.evaluate_account(account_id)
    summary = await copilot_service.generate_summary(report)
    return CopilotResponse(account_id=account_id, summary=summary)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)