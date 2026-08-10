import { createContext, ReactNode, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import { RiskEvaluationResponse } from '../api/client'

interface AppContextValue {
  currentAccount: RiskEvaluationResponse | null
  setCurrentAccount: (account: RiskEvaluationResponse | null) => void
  evaluateAccount: (accountId: string) => Promise<void>
  isEvaluating: boolean
  evaluationError: string | null
  recentEvaluations: RecentEvaluation[]
  addRecentEvaluation: (evaluation: RecentEvaluation) => void
}

const AppContext = createContext<AppContextValue | null>(null)

interface RecentEvaluation {
  account_id: string
  risk_score: number
  risk_level: string
  kill_chain_stage: string
  is_simulated: boolean
  timestamp: number
}

const STORAGE_KEY = 'muleradar_recent_evaluations'

function getStoredEvaluations(): RecentEvaluation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveEvaluations(evals: RecentEvaluation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(evals.slice(0, 10)))
  } catch {
    // Ignore storage errors
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentAccount, setCurrentAccount] = useState<RiskEvaluationResponse | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evaluationError, setEvaluationError] = useState<string | null>(null)
  const [recentEvaluations, setRecentEvaluations] = useState<AppContextValue['recentEvaluations']>(() => getStoredEvaluations())

  const addRecentEvaluation = useCallback((evaluation: RecentEvaluation) => {
    setRecentEvaluations(prev => {
      const updated = [evaluation, ...prev.filter(e => e.account_id !== evaluation.account_id)].slice(0, 10)
      saveEvaluations(updated)
      return updated
    })
  }, [])

  const evaluateAccount = useCallback(async (accountId: string) => {
    const trimmed = accountId.trim()
    if (!trimmed) return
    
    setIsEvaluating(true)
    setEvaluationError(null)
    
    try {
      // Import dynamically to avoid circular dependencies
      const { evaluateAccount: apiEvaluate } = await import('../api/client')
      const result = await apiEvaluate(trimmed)
      setCurrentAccount(result)
      addRecentEvaluation({
        account_id: result.account_id,
        risk_score: result.risk_score,
        risk_level: result.risk_level,
        kill_chain_stage: result.kill_chain_stage,
        is_simulated: result.is_simulated,
        timestamp: Date.now(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to evaluate account'
      setEvaluationError(message)
      setCurrentAccount(null)
    } finally {
      setIsEvaluating(false)
    }
  }, [addRecentEvaluation])

  // Clear error when account changes
  useEffect(() => {
    if (currentAccount) {
      setEvaluationError(null)
    }
  }, [currentAccount])

  const value = useMemo(() => ({
    currentAccount,
    setCurrentAccount,
    evaluateAccount,
    isEvaluating,
    evaluationError,
    recentEvaluations,
    addRecentEvaluation,
  }), [currentAccount, evaluateAccount, isEvaluating, evaluationError, recentEvaluations, addRecentEvaluation])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return ctx
}