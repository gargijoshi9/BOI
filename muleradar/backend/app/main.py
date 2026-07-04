import sys
from pathlib import Path

# --- PATH RESOLUTION ---
# This finds the root 'muleradar' folder so we can securely import 'ml_pipeline'
# __file__ represents main.py -> app/ -> backend/ -> muleradar/
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict

# Import the ML Engine from the parallel folder
from ml_pipeline.analyzer import MuleRiskAnalyzer

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

# --- INITIALIZE ML ENGINE ---
analyzer_engine = MuleRiskAnalyzer()

# ---------------------------------------------------------
# PYDANTIC DATA MODELS
# ---------------------------------------------------------

class DamageMetrics(BaseModel):
    recoverable_amount: float = Field(..., description="Potential funds that can be frozen/recovered")
    in_transit_amount: float = Field(..., description="Funds currently moving through channels")

class ShapContribution(BaseModel):
    feature: str = Field(..., description="Name of the behavior flag")
    contribution: float = Field(..., description="Impact weight on the final risk score")

class NetworkNode(BaseModel):
    id: str
    type: str  # e.g., "mule", "smurf", "layering_layer", "cash_out"

class NetworkEdge(BaseModel):
    source: str
    target: str
    amount: float

class NetworkGraph(BaseModel):
    nodes: List[NetworkNode]
    edges: List[NetworkEdge]

# This is the master layout the frontend expects to receive
class RiskEvaluationResponse(BaseModel):
    account_id: str
    risk_score: int = Field(..., ge=0, le=1000, description="Risk score scaled from 0 to 1000")
    risk_level: str  # "Low", "Medium", "High", "Critical"
    kill_chain_stage: str  # "Placement", "Layering", "Integration", "None"
    damage_metrics: DamageMetrics
    shap_explanation: List[ShapContribution]
    network_connections: NetworkGraph

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
    Evaluates an account ID against the detection pipeline.
    Returns structured risk metrics, network routing graphs, and explainable AI insights.
    """
    # Ask the ML engine to calculate the dynamic risk for this specific account
    intelligence_report = analyzer_engine.evaluate_account(account_id)
    
    return intelligence_report


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)