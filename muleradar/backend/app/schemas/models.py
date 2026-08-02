from pydantic import BaseModel, Field
from typing import List, Optional


class DamageMetrics(BaseModel):
    recoverable_amount: float = Field(
        ..., description="Potential funds that can be frozen/recovered"
    )
    in_transit_amount: float = Field(
        ..., description="Funds currently moving through channels"
    )
    is_estimated: bool = Field(
        default=True,
        description=(
            "True if these figures are derived/estimated from available "
            "feature values rather than verified transaction records. "
            "Analysts should treat estimated figures as directional, not "
            "authoritative, until confirmed against source transaction data."
        ),
    )
    estimation_note: Optional[str] = Field(
        default=None,
        description="Human-readable explanation of how the estimate was derived, if applicable.",
    )


class ShapContribution(BaseModel):
    feature: str = Field(..., description="Name of the behavior flag")
    contribution: float = Field(..., description="Impact weight on the final risk score")


class NetworkNode(BaseModel):
    id: str
    type: str  # e.g., "mule", "smurf", "layering_layer", "cash_out", "relay", "normal"


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
    kill_chain_stage: str  # "Monitoring"/"None", "Placement", "Layering", "Cash-Out", etc.
    damage_metrics: DamageMetrics
    shap_explanation: List[ShapContribution]
    network_connections: NetworkGraph
    is_simulated: bool = Field(
        default=False,
        description=(
            "True if this result came from the deterministic simulator "
            "fallback (no trained model artifacts, or the account_id was "
            "not found in the source dataset), rather than the live "
            "ensemble model. The frontend should visibly flag simulated "
            "results so they are never mistaken for verified predictions."
        ),
    )


class CopilotResponse(BaseModel):
    account_id: str
    summary: str


class BatchEvaluationRequest(BaseModel):
    account_ids: List[str] = Field(..., description="List of account IDs to evaluate in a batch")