from pydantic import BaseModel, Field
from typing import List

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

class RiskEvaluationResponse(BaseModel):
    account_id: str
    risk_score: int = Field(..., ge=0, le=1000, description="Risk score scaled from 0 to 1000")
    risk_level: str  # "Low", "Medium", "High", "Critical"
    kill_chain_stage: str  # "Placement", "Layering", "Integration", "None"
    damage_metrics: DamageMetrics
    shap_explanation: List[ShapContribution]
    network_connections: NetworkGraph

class CopilotResponse(BaseModel):
    account_id: str
    summary: str

class BatchEvaluationRequest(BaseModel):
    account_ids: List[str] = Field(..., description="List of account IDs to evaluate in a batch")
