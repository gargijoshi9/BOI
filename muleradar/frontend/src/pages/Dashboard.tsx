import { FormEvent, useEffect, useState } from 'react'
import PageShell from '../components/PageShell'
import MainGrid from '../components/MainGrid'
import { useAccountEvaluation } from '../hooks/useAccountEvaluation'
import { evaluateBatch, fetchAccounts } from '../api/client'
import { AccountsTableRow } from '../components/AccountsTable'

function Dashboard() {
  const { data, loading, error, evaluate } = useAccountEvaluation()
  const [accountInput, setAccountInput] = useState('')
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<AccountsTableRow[]>([])

  useEffect(() => {
    async function loadInitialAccounts() {
      try {
        const initialAccounts = await fetchAccounts(25)
        setAccounts(initialAccounts)
      } catch (err) {
        console.error('Failed to load initial accounts:', err)
      }
    }
    loadInitialAccounts()
  }, [])

  async function handleEvaluate(id: string) {
    const trimmed = id.trim()
    if (!trimmed) return
    setActiveAccountId(trimmed)
    await evaluate(trimmed)
    try {
      const results = await evaluateBatch([trimmed])
      if (results.length > 0) {
        setAccounts(
          results.map((r) => ({
            account_id: r.account_id,
            risk_score: r.risk_score,
            risk_level: r.risk_level,
            kill_chain_stage: r.kill_chain_stage,
            damage_metrics: r.damage_metrics,
          })),
        )
      }
    } catch {
      /* keep existing directory */
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    handleEvaluate(accountInput)
  }

  return (
    <PageShell>
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-row items-stretch border-b border-border"
      >
        <input
          type="text"
          value={accountInput}
          onChange={(e) => setAccountInput(e.target.value)}
          placeholder="Enter Account ID..."
          className="flex-1 border border-r-0 border-foreground bg-background px-4 py-3 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none"
        />
        <button
          type="submit"
          className="border border-l border-foreground bg-background px-6 py-3 text-sm font-medium uppercase tracking-wider text-foreground hover:bg-white hover:text-background"
        >
          Evaluate
        </button>
      </form>

      {loading && (
        <p className="border-b border-border bg-background px-6 py-2 text-xs text-foreground-muted">
          Evaluating...
        </p>
      )}
      {error && !loading && (
        <p className="border-b border-border bg-background px-6 py-2 text-xs text-[#ef4444]">
          Error fetching account: {error}
        </p>
      )}

      <div className="flex flex-1 flex-col overflow-hidden pt-6">
        <MainGrid
          riskScore={data?.risk_score}
          riskLevel={data?.risk_level}
          killChainStage={data?.kill_chain_stage}
          damageMetrics={data?.damage_metrics}
          shapExplanation={data?.shap_explanation}
          networkConnections={data?.network_connections}
          accounts={accounts}
          activeAccountId={activeAccountId}
          onAccountSelect={(id) => {
            setAccountInput(id)
            handleEvaluate(id)
          }}
        />
      </div>
    </PageShell>
  )
}

export default Dashboard
