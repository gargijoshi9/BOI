import axios, { AxiosInstance } from 'axios'

// ---------- Shared types ----------

export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low'
export type KillChainStage = 'Placement' | 'Layering' | 'Integration'
export type NodeType = 'mule' | 'normal' | 'cash_out'

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
}

export interface RiskEvaluationResponse {
  account_id: string
  risk_score: number
  risk_level: RiskLevel
  kill_chain_stage: KillChainStage
  damage_metrics: DamageMetrics
  shap_explanation: ShapFeature[]
  network_connections: NetworkConnections
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
