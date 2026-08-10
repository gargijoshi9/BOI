import { FormEvent, useState, useEffect } from 'react'
import PageShell from '../components/PageShell'
import RiskScoreWidget from '../components/RiskScoreWidget'
import KillChainWidget from '../components/KillChainWidget'
import DamageForecastWidget from '../components/DamageForecastWidget'
import { Link } from 'react-router-dom'
import { useDrawer } from '../context/DrawerContext'
import { useApp } from '../context/AppContext'

function Dashboard() {
  const { currentAccount, evaluateAccount, isEvaluating, evaluationError, recentEvaluations } = useApp()
  const { openDrawerForAccount } = useDrawer()
  const [accountInput, setAccountInput] = useState('')

  // Sync local input with current account if available
  useEffect(() => {
    if (currentAccount && accountInput !== currentAccount.account_id) {
      setAccountInput(currentAccount.account_id)
    }
  }, [currentAccount])

  async function handleEvaluate(id: string) {
    await evaluateAccount(id)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    handleEvaluate(accountInput)
  }

  const hasEvaluation = currentAccount !== null

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Critical': return '#ef4444'
      case 'High': return '#f97316'
      case 'Medium': return '#eab308'
      case 'Low': return '#22c55e'
      default: return '#94a3b8'
    }
  }

  const getRiskGlow = (level: string) => {
    switch (level) {
      case 'Critical': return '0 0 12px rgba(239, 68, 68, 0.4)'
      case 'High': return '0 0 12px rgba(249, 115, 22, 0.4)'
      case 'Medium': return '0 0 12px rgba(234, 179, 8, 0.4)'
      case 'Low': return '0 0 12px rgba(34, 197, 94, 0.4)'
      default: return 'none'
    }
  }

  function renderEvaluationContent() {
    if (!hasEvaluation) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <div className="glass flex flex-col items-center p-12 text-center max-w-md">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: 'rgba(34, 211, 238, 0.1)', border: '1px solid rgba(34, 211, 238, 0.3)' }}>
              <span className="text-3xl">🔍</span>
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#f8fafc' }}>Ready to Evaluate</h2>
            <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>
              Enter an Account ID above to run a real-time fraud risk assessment.
              The system will analyze transaction patterns, network connections, and SHAP feature importance using the trained ML ensemble.
            </p>
            <div className="flex flex-row gap-3">
              <Link
                to="/accounts"
                className="px-4 py-2 text-sm font-medium uppercase tracking-wider rounded-lg transition-all"
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                }}
              >
                Browse Accounts
              </Link>
              <Link
                to="/network"
                className="px-4 py-2 text-sm font-medium uppercase tracking-wider rounded-lg transition-all"
                style={{
                  background: 'rgba(34, 211, 238, 0.1)',
                  border: '1px solid rgba(34, 211, 238, 0.4)',
                  color: '#22d3ee',
                }}
              >
                View Network
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return (
      <>
        {/* Top Row - Risk Score & Damage Forecast */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <RiskScoreWidget
            riskScore={currentAccount!.risk_score}
            riskLevel={currentAccount!.risk_level}
            isSimulated={currentAccount!.is_simulated}
          />
          <DamageForecastWidget damageMetrics={currentAccount!.damage_metrics} />
        </div>

        {/* Kill Chain Stage - Full Width Below */}
        <KillChainWidget killChainStage={currentAccount!.kill_chain_stage} />

        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass p-5 flex flex-row items-center gap-4 glow-cyan">
            <div className="p-3 rounded-lg" style={{ background: 'rgba(34, 211, 238, 0.15)' }}>
              <span className="text-2xl">🔗</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#94a3b8' }}>Network Connections</p>
              <p className="text-xl font-bold text-gradient-cyan-purple">
                {currentAccount!.network_connections?.nodes.length ?? 0} Nodes
              </p>
            </div>
          </div>
          <div className="glass p-5 flex flex-row items-center gap-4 glow-purple">
            <div className="p-3 rounded-lg" style={{ background: 'rgba(168, 85, 247, 0.15)' }}>
              <span className="text-2xl">💰</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#94a3b8' }}>Total Exposure</p>
              <p className="text-xl font-bold" style={{ color: '#a855f7' }}>
                ₹{((currentAccount!.damage_metrics?.recoverable_amount ?? 0) + (currentAccount!.damage_metrics?.in_transit_amount ?? 0)).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <div className="glass p-5 flex flex-row items-center gap-4">
            <div className="p-3 rounded-lg" style={{ background: 'rgba(249, 115, 22, 0.15)' }}>
              <span className="text-2xl">⚡</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#94a3b8' }}>Kill Chain Stage</p>
              <p className="text-xl font-bold" style={{ color: '#f97316' }}>{currentAccount!.kill_chain_stage}</p>
            </div>
          </div>
          <div className="glass p-5 flex flex-row items-center gap-4">
            <div className="p-3 rounded-lg" style={{ background: 'rgba(34, 197, 94, 0.15)' }}>
              <span className="text-2xl">🛡️</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#94a3b8' }}>Recoverable</p>
              <p className="text-xl font-bold" style={{ color: '#22c55e' }}>
                ₹{(currentAccount!.damage_metrics?.recoverable_amount ?? 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation to SHAP & Network Pages */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/shap"
            className="glass flex flex-row items-center gap-4 p-5 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all"
            style={{ borderColor: 'rgba(34, 211, 238, 0.2)' }}
          >
            <div className="p-3 rounded-lg" style={{ background: 'rgba(168, 85, 247, 0.15)' }}>
              <span className="text-2xl">📊</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#94a3b8' }}>SHAP Explainability</p>
              <p className="text-lg font-bold" style={{ color: '#a855f7' }}>View Feature Importance</p>
            </div>
          </Link>
          <Link
            to="/network"
            className="glass flex flex-row items-center gap-4 p-5 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all"
            style={{ borderColor: 'rgba(34, 211, 238, 0.2)' }}
          >
            <div className="p-3 rounded-lg" style={{ background: 'rgba(34, 211, 238, 0.15)' }}>
              <span className="text-2xl">🔗</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#94a3b8' }}>Transaction Network</p>
              <p className="text-lg font-bold text-gradient-cyan-purple">Visualize Fraud Ring</p>
            </div>
          </Link>
        </div>

        {/* Recent Evaluations */}
        <div className="glass flex flex-col p-5">
          <div className="flex flex-row items-center justify-between mb-4">
            <h3 className="text-xs font-medium uppercase" style={{ color: '#cbd5e1', letterSpacing: '0.18em' }}>
              Recent Evaluations
            </h3>
            <Link
              to="/accounts"
              className="text-xs font-medium"
              style={{ color: '#22d3ee' }}
            >
              View All →
            </Link>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {recentEvaluations.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: '#94a3b8' }}>
                Recent evaluations will appear here after you evaluate accounts
              </p>
            ) : (
              recentEvaluations.map((acc) => (
                <button
                  key={acc.account_id}
                  onClick={() => {
                    setAccountInput(acc.account_id)
                    handleEvaluate(acc.account_id)
                  }}
                  className="block w-full p-3 rounded-lg transition-all hover:bg-white/5 border text-left"
                  style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
                >
                  <div className="flex flex-row items-center justify-between">
                    <span className="font-mono text-sm" style={{ color: '#f8fafc' }}>
                      {acc.account_id}
                      {acc.is_simulated && (
                        <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-red-500/20 text-red-400">
                          Sim
                        </span>
                      )}
                    </span>
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded"
                      style={{
                        background: `${getRiskColor(acc.risk_level)}33`,
                        color: getRiskColor(acc.risk_level),
                        boxShadow: getRiskGlow(acc.risk_level),
                      }}
                    >
                      {acc.risk_level}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-row items-center gap-3 text-xs" style={{ color: '#94a3b8' }}>
                    <span>Score: <span className="font-bold" style={{ color: '#f8fafc' }}>{acc.risk_score}</span></span>
                    <span>{acc.kill_chain_stage}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <PageShell>
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-6">
        {/* Header with Search */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-row items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: '#f8fafc' }}>
                Fraud Operations Console
              </h1>
              <p className="mt-1 text-sm" style={{ color: '#94a3b8' }}>
                Real-time mule account detection & risk assessment
              </p>
            </div>
            <div className="flex flex-row items-center gap-3">
              <Link
                to="/accounts"
                className="px-4 py-2 text-sm font-medium uppercase tracking-wider rounded-lg transition-all"
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.4)'
                  e.currentTarget.style.color = '#22d3ee'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.color = '#cbd5e1'
                }}
              >
                Browse Accounts
              </Link>
              {hasEvaluation && (
                <button
                  type="button"
                  onClick={() => openDrawerForAccount(currentAccount!.account_id)}
                  className="px-4 py-2 text-sm font-medium uppercase tracking-wider rounded-lg transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.1), rgba(168, 85, 247, 0.1))',
                    border: '1px solid rgba(34, 211, 238, 0.3)',
                    color: '#22d3ee',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.6)'
                    e.currentTarget.style.boxShadow = '0 0 16px rgba(34, 211, 238, 0.2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.3)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  ⚡ AI Summary
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-row items-stretch gap-3 max-w-2xl">
            <input
              type="text"
              value={accountInput}
              onChange={(e) => setAccountInput(e.target.value)}
              placeholder="Enter Account ID to evaluate..."
              className="flex-1 px-4 py-3 text-sm focus:outline-none"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                borderRadius: '8px',
                transition: 'border-color 200ms ease, box-shadow 200ms ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.4)'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 211, 238, 0.08)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
            <button
              type="submit"
              disabled={isEvaluating}
              className="px-6 py-3 text-sm font-medium uppercase tracking-wider rounded-lg transition-all whitespace-nowrap"
              style={{
                background: isEvaluating ? 'rgba(34, 211, 238, 0.05)' : 'rgba(34, 211, 238, 0.1)',
                border: isEvaluating ? '1px solid rgba(34, 211, 238, 0.2)' : '1px solid rgba(34, 211, 238, 0.4)',
                color: isEvaluating ? '#22d3ee80' : '#22d3ee',
                cursor: isEvaluating ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (isEvaluating) return
                e.currentTarget.style.background = 'rgba(34, 211, 238, 0.2)'
                e.currentTarget.style.boxShadow = '0 0 20px rgba(34, 211, 238, 0.2)'
              }}
              onMouseLeave={(e) => {
                if (isEvaluating) return
                e.currentTarget.style.background = 'rgba(34, 211, 238, 0.1)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {isEvaluating ? 'Evaluating...' : 'Evaluate'}
            </button>
          </form>
        </div>

        {isEvaluating && (
          <div className="glass flex items-center justify-center p-4 border border-cyan-500/20">
            <p className="text-sm" style={{ color: '#22d3ee' }}>
              Analyzing account...
              <span className="ellipsis-dot ml-1">.</span>
              <span className="ellipsis-dot">.</span>
              <span className="ellipsis-dot">.</span>
            </p>
          </div>
        )}
        {evaluationError && !isEvaluating && (
          <div className="glass flex items-center justify-center p-4 border border-red-500/30 bg-red-500/5">
            <p className="text-sm" style={{ color: '#ef4444' }}>Error: {evaluationError}</p>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1">
          {renderEvaluationContent()}
        </div>
      </div>
    </PageShell>
  )
}

export default Dashboard