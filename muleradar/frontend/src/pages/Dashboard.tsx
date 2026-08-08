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
            is_simulated: r.is_simulated,
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
        className="flex w-full flex-row items-stretch"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <input
          type="text"
          value={accountInput}
          onChange={(e) => setAccountInput(e.target.value)}
          placeholder="Enter Account ID..."
          className="flex-1 px-4 py-3 text-sm focus:outline-none"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#f8fafc',
            transition: 'border-color 200ms ease, box-shadow 200ms ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.4)'
            e.currentTarget.style.boxShadow =
              '0 0 0 3px rgba(34, 211, 238, 0.08)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
        <button
          type="submit"
          className="px-6 py-3 text-sm font-medium uppercase tracking-wider"
          style={{
            background: 'rgba(34, 211, 238, 0.1)',
            border: '1px solid rgba(34, 211, 238, 0.4)',
            color: '#22d3ee',
            transition: 'all 200ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(34, 211, 238, 0.2)'
            e.currentTarget.style.boxShadow =
              '0 0 20px rgba(34, 211, 238, 0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(34, 211, 238, 0.1)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          Evaluate
        </button>
      </form>

      {loading && (
        <p
          className="px-6 py-2 text-xs"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            color: '#cbd5e1',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          Evaluating...
        </p>
      )}
      {error && !loading && (
        <p
          className="px-6 py-2 text-xs"
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            color: '#ef4444',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
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
          isSimulated={data?.is_simulated}
          evaluatedAccountId={data?.account_id}
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
