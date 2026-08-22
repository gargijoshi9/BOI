import axios, { AxiosInstance } from 'axios'

// ---------- Shared types ----------

export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low'

// 'None' is a real value the backend sends for Low-risk / no-active-stage
// accounts (see analyzer.py's risk-score bucketing). Omitting it here was
// the root cause of KillChainWidget rendering "Stage 0 of 3" with no
// highlighted box - always include every value the backend can actually
// emit, even ones that feel like "no value."
export type KillChainStage = 'Placement' | 'Layering' | 'Integration' | 'None'

export type NodeType = 'mule' | 'normal' | 'cash_out' | 'relay'

export interface HealthResponse {
  status: 'healthy' | string
  mode: 'Simulated Mode' | 'Live Model Active' | string
  models: string[]
}

export interface ShapFeature {
  feature: string
  contribution: number
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

export interface DamageMetrics {
  recoverable_amount: number
  in_transit_amount: number
  // True when these figures are derived/estimated rather than verified
  // against real transaction records. Always render this distinction in
  // the UI - never present an estimate as a confirmed figure.
  is_estimated: boolean
  estimation_note?: string | null
}

export interface RiskEvaluationResponse {
  account_id: string
  risk_score: number
  risk_level: RiskLevel
  kill_chain_stage: KillChainStage
  damage_metrics: DamageMetrics
  shap_explanation: ShapFeature[]
  network_connections: NetworkConnections
  // True when this result came from the deterministic simulator fallback
  // (no trained model artifacts, or account_id not found in the source
  // dataset) rather than the live ensemble model. Must be surfaced
  // visibly in the UI so simulated results are never mistaken for real
  // predictions during a live demo.
  is_simulated: boolean
}

export interface AIAssistantSummaryResponse {
  summary: string
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
  limit: number = 50,
): Promise<RiskEvaluationResponse[]> {
  const { data } = await api.get<RiskEvaluationResponse[]>('/api/v1/accounts', {
    params: { limit },
  })
  return data
}