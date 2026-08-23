from typing import List, Optional
from pydantic import BaseModel, Field

# ==========================================
# CORE EVALUATION SCHEMAS
# ==========================================

class DamageMetrics(BaseModel):
    recoverable_amount: float
    in_transit_amount: float
    is_estimated: bool = True
    estimation_note: Optional[str] = None

class ShapContribution(BaseModel):
    feature: str
    contribution: float

class GraphNode(BaseModel):
    id: str
    type: str

class GraphEdge(BaseModel):
    source: str
    target: str
    amount: Optional[float] = None

class NetworkGraph(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    centrality_score: Optional[float] = None
    clustering_coefficient: Optional[float] = None

class HumanReviewInfo(BaseModel):
    requires_review: bool = Field(
        ...,
        description="True if this account should be routed to a human investigator before taking action."
    )
    review_reason: Optional[str] = Field(
        default=None,
        description="Reason for review: borderline_confidence or anomaly_override."
    )
    confidence_band: str = Field(
        ...,
        description="AUTO_CLEAR, HUMAN_REVIEW, or AUTO_BLOCK."
    )
    anomaly_flagged: bool = Field(
        default=False,
        description="True if Isolation Forest classified the account as a distribution outlier."
    )

class RiskEvaluationResponse(BaseModel):
    account_id: str
    # ----- UI Columns -----
    account_type: str = "Unknown"
    occupation: str = "Unknown"
    age: int = 0
    anomaly_score: float = 0.0
    model_probability: float = 0.0
    # ----------------------
    risk_score: int = Field(..., ge=0, le=1000)
    risk_level: str
    kill_chain_stage: str
    damage_metrics: DamageMetrics
    shap_explanation: List[ShapContribution]
    network_connections: NetworkGraph
    human_review: HumanReviewInfo
    is_simulated: bool = Field(default=False)
    # --- ADDED HONESTY FLAG ---
    was_seen_during_training: bool = Field(
        default=False,
        description=(
            "True if this account was part of the model's training set. "
            "Scores for these accounts reflect in-sample fit, not genuine "
            "held-out generalization - never present these as verified "
            "predictions in the UI without this caveat."
        )
    )

# ==========================================
# CSV VALIDATION SCHEMAS
# ==========================================

class ValidationWarnings(BaseModel):
    missing_columns: List[str] = Field(...)
    extra_columns_ignored: int = Field(...)

class ValidationResponse(BaseModel):
    filename: str
    n_rows: int
    warnings: ValidationWarnings
    methodology_note: str = Field(...)
    results: List[RiskEvaluationResponse]

# ==========================================
# HUMAN-IN-THE-LOOP (HITL) SCHEMAS 
# ==========================================

class ReviewQueueItem(BaseModel):
    account_id: str
    risk_score: int
    risk_level: str
    review_reason: Optional[str] = None
    queued_at: str

class ReviewQueueResponse(BaseModel):
    total: int
    items: List[ReviewQueueItem]

class ReviewDecisionRequest(BaseModel):
    decision: str = Field(..., description="One of: confirm_mule, clear, escalate")
    reviewer_name: str
    note: Optional[str] = ""

class ReviewDecisionRecord(BaseModel):
    account_id: str
    decision: str
    reviewer_name: str
    note: str
    model_risk_score: int
    model_review_reason: Optional[str]
    timestamp: str