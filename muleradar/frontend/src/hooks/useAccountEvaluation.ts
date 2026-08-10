import { useState } from 'react'
import {
  evaluateAccount,
  fetchAIAssistantSummary,
  RiskEvaluationResponse,
} from '../api/client'

export interface UseAccountEvaluationResult {
  data: RiskEvaluationResponse | null
  summary: string | null
  loading: boolean
  error: string | null
}

export function useAccountEvaluation() {
  const [data, setData] = useState<RiskEvaluationResponse | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function evaluate(accountId: string) {
    if (!accountId) return
    setLoading(true)
    setError(null)
    setData(null)
    setSummary(null)
    try {
      const [evalResult, summaryResult] = await Promise.all([
        evaluateAccount(accountId),
        fetchAIAssistantSummary(accountId).catch(() => null),
      ])
      setData(evalResult)
      if (summaryResult !== null) setSummary(summaryResult)
    } catch (e: any) {
      const message =
        e.response?.data?.detail ||
        (e instanceof Error ? e.message : 'Failed to evaluate account')
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return { data, summary, loading, error, evaluate }
}
