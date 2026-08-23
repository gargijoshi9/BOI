import axios, { AxiosInstance } from 'axios'

// ---------- Shared types ----------

export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low'

export type NodeType = 'mule' | 'normal' | 'cash_out' | 'relay'

export interface HealthResponse {
  status: 'healthy' | 'online' | string
  mode?: 'Simulated Mode' | 'Live Model Active' | string
  models?: string[]
  ml_engine?: string
}

export interface ShapFeature {
  feature: string
  contribution: number
  display_name?: string
  description?: string
}

export interface GraphNode {
  id: string
  type: NodeType
}

export interface GraphEdge {
  source: string
  target: string
  amount: number
}

export interface NetworkConnections {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type ConfidenceBand = 'AUTO_CLEAR' | 'HUMAN_REVIEW' | 'AUTO_BLOCK'

export interface HumanReviewInfo {
  requires_review: boolean
  review_reason: string | null
  confidence_band: ConfidenceBand
  anomaly_flagged: boolean
}

export interface RiskEvaluationResponse {
  account_id: string
  // ----- New UI Columns -----
  account_type?: string
  occupation?: string
  age?: number
  anomaly_score?: number
  model_probability?: number
  model_component_scores?: {
    xgb_probability?: number;
    lgbm_probability?: number;
    cat_probability?: number;
    anomaly_score_if?: number;
    combination_method?: string;
  }
  // --------------------------
  risk_score: number
  risk_level: RiskLevel
  human_review: HumanReviewInfo
  shap_explanation: ShapFeature[]
  network_connections: NetworkConnections
  // True when this result came from the deterministic simulator fallback
  // (no trained model artifacts, or account_id not found in the source
  // dataset) rather than the live ensemble model. Must be surfaced
  // visibly in the UI so simulated results are never mistaken for real
  // predictions during a live demo.
  is_simulated: boolean
  // --- ADDED HONESTY FLAG ---
  was_seen_during_training: boolean
}

export interface AIAssistantSummaryResponse {
  summary: string
}

// ---------- HITL & Validation Types ----------

export interface ReviewQueueItem {
  account_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  review_reason?: string;
  queued_at: string;
}

export interface ReviewQueueResponse {
  total: number;
  items: ReviewQueueItem[];
}

export interface ReviewDecisionRequest {
  decision: 'confirm_mule' | 'clear' | 'escalate';
  reviewer_name: string;
  note?: string;
}

export interface ReviewDecisionRecord {
  account_id: string;
  decision: string;
  reviewer_name: string;
  note: string;
  model_risk_score: number;
  model_review_reason?: string;
  timestamp: string;
}

export interface ValidationWarnings {
  missing_columns: string[];
  extra_columns_ignored: number;
}

export interface ValidationResponse {
  filename: string;
  n_rows: number;
  warnings: ValidationWarnings;
  methodology_note: string;
  results: RiskEvaluationResponse[];
}

// ---------- Base axios instance ----------

export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach X-API-Key via a request interceptor rather than a static header
// on the instance. This matters because:
//   1. If VITE_API_KEY is unset (default local-dev state, matching the
//      backend's own default no-auth state), we want to send NO header
//      at all - not a header with the literal string "undefined".
//   2. An interceptor re-evaluates the env value per request rather than
//      baking it in once at module import time, which is more robust if
//      the env is ever swapped at runtime in a future refactor.
api.interceptors.request.use((config) => {
  const apiKey = import.meta.env.VITE_API_KEY
  if (apiKey) {
    config.headers = config.headers ?? {}
    config.headers['X-API-Key'] = apiKey
  }
  return config
})

// ---------- Endpoint functions ----------

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health')
  return data
}

export async function evaluateAccount(
  accountId: string,
): Promise<RiskEvaluationResponse> {
  const { data } = await api.post<RiskEvaluationResponse>(
    `/api/v1/evaluate/${accountId}`,
  )
  return data
}

export async function evaluateBatch(
  ids: string[],
): Promise<RiskEvaluationResponse[]> {
  const { data } = await api.post<RiskEvaluationResponse[]>(
    '/api/v1/evaluate/batch/',
    { account_ids: ids },
  )
  return data
}

export async function fetchAIAssistantSummary(
  accountId: string,
): Promise<string> {
  const { data } = await api.get<AIAssistantSummaryResponse>(
    `/api/v1/copilot/summarize/${accountId}`,
  )
  return data.summary
}

export async function fetchAccounts(
  limit?: number,
  heldOutOnly: boolean = true
): Promise<RiskEvaluationResponse[]> {
  const { data } = await api.get<RiskEvaluationResponse[]>('/api/v1/accounts', {
    params: { 
      ...(limit ? { limit } : {}),
      held_out_only: heldOutOnly
    },
  })
  return data
}

// ---------- HITL & Validation API Calls ----------

export async function fetchReviewQueue(limit: number = 100): Promise<ReviewQueueResponse> {
  const { data } = await api.get<ReviewQueueResponse>('/api/v1/review-queue', {
    params: { limit }
  })
  return data
}

export async function resolveReview(
  accountId: string, 
  requestData: ReviewDecisionRequest
): Promise<ReviewDecisionRecord> {
  const { data } = await api.post<ReviewDecisionRecord>(
    `/api/v1/review-queue/${accountId}/resolve`,
    requestData
  )
  return data
}

export async function fetchAuditTrail(
  accountId?: string
): Promise<ReviewDecisionRecord[]> {
  const { data } = await api.get<ReviewDecisionRecord[]>('/api/v1/review-queue/audit-trail', {
    params: accountId ? { account_id: accountId } : undefined
  })
  return data
}

export async function validateDataset(
  file: File
): Promise<ValidationResponse> {
  const formData = new FormData()
  formData.append('file', file)
  // Axios automatically sets the Content-Type to multipart/form-data when passing FormData
  const { data } = await api.post<ValidationResponse>(
    '/api/v1/validate', 
    formData
  )
  return data
}