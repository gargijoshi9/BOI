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

  function renderEvaluationContent() {
    if (!hasEvaluation) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <div className="glass text-center p-10 md:p-16 max-w-xl mx-auto border border-border/50">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center bg-accent/10">
              <svg className="h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <h2 className="text-heading-lg font-bold text-foreground mb-3">Ready to Evaluate</h2>
            <p className="text-body-md text-foreground-muted mb-8 max-w-sm mx-auto">
              Enter an Account ID above to run a real-time fraud risk assessment.
              The system analyzes transaction patterns, network connections, and SHAP feature importance using the trained ML ensemble.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/accounts" className="btn-secondary">
                Browse Accounts
              </Link>
              <Link to="/network" className="btn-primary">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
                View Network
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <RiskScoreWidget
            riskScore={currentAccount!.risk_score}
            riskLevel={currentAccount!.risk_level}
            isSimulated={currentAccount!.is_simulated}
          />
          <DamageForecastWidget damageMetrics={currentAccount!.damage_metrics} />
        </div>
        <div className="mb-5">
          <KillChainWidget killChainStage={currentAccount!.kill_chain_stage} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {currentAccount!.risk_score >= 800 ? (
            <button className="btn-primary flex-1 gap-2" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M10 4v16" />
              </svg>
              <span>Auto-Freeze Account</span>
            </button>
          ) : (
            <button className="btn-secondary flex-1 gap-2" style={{ background: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.3)', color: '#eab308' }}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Human Review Required</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div className="card card-hover">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-accent/15">
                <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <div>
                <p className="stat-label">Network Connections</p>
                <p className="font-mono font-bold text-heading-sm text-accent">
                  {currentAccount!.network_connections?.nodes.length ?? 0} Nodes
                </p>
              </div>
            </div>
          </div>
          <div className="card card-hover">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-500/15">
                <svg className="h-5 w-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <p className="stat-label">Total Exposure</p>
                <p className="font-mono font-bold text-heading-sm text-purple-400">
                  ₹{((currentAccount!.damage_metrics?.recoverable_amount ?? 0) + (currentAccount!.damage_metrics?.in_transit_amount ?? 0)).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>
          <div className="card card-hover">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/15">
                <svg className="h-5 w-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div>
                <p className="stat-label">Kill Chain Stage</p>
                <p className="font-mono font-bold text-heading-sm text-amber-500">{currentAccount!.kill_chain_stage}</p>
              </div>
            </div>
          </div>
          <div className="card card-hover">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-500/15">
                <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16" />
                  <polyline points="23 21 16 14 9 21 4 16" />
                </svg>
              </div>
              <div>
                <p className="stat-label">Recoverable</p>
                <p className="font-mono font-bold text-heading-sm text-green-500">
                  ₹{(currentAccount!.damage_metrics?.recoverable_amount ?? 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          <Link to="/shap" className="card card-hover flex items-center gap-4 p-5">
            <div className="p-3 rounded-xl bg-purple-500/15">
              <svg className="h-6 w-6 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 20V10" />
                <path d="M12 20V4" />
                <path d="M6 20v-6" />
              </svg>
            </div>
            <div>
              <p className="stat-label">SHAP Explainability</p>
              <p className="font-semibold text-heading-sm text-purple-400">View Feature Importance</p>
            </div>
          </Link>
          <Link to="/network" className="card card-hover flex items-center gap-4 p-5">
            <div className="p-3 rounded-xl bg-accent/15">
              <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <div>
              <p className="stat-label">Transaction Network</p>
              <p className="font-semibold text-heading-sm text-accent">Visualize Fraud Ring</p>
            </div>
          </Link>
        </div>

        <div className="card flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-heading-sm font-semibold text-foreground">Recent Evaluations</h3>
            <Link to="/accounts" className="text-body-sm font-medium text-accent hover:text-accent-hover transition-colors">
              View All →
            </Link>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {recentEvaluations.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-body-sm text-foreground-muted">
                  Recent evaluations will appear here after you evaluate accounts
                </p>
              </div>
            ) : (
              recentEvaluations.map((acc) => (
                <button
                  key={acc.account_id}
                  onClick={() => {
                    setAccountInput(acc.account_id)
                    handleEvaluate(acc.account_id)
                  }}
                  className="w-full p-4 rounded-xl text-left transition-all hover:bg-background-cardHover border border-border/50"
                >
                  <div className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-body-md text-foreground">{acc.account_id}</span>
                      {acc.is_simulated && (
                        <span className="badge badge-high">Sim</span>
                      )}
                    </div>
                    <span className={`badge ${['Critical', 'High'].includes(acc.risk_level) ? 'badge-critical' : ['Medium'].includes(acc.risk_level) ? 'badge-medium' : 'badge-low'}`}>
                      {acc.risk_level}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-row items-center gap-4 text-body-sm text-foreground-muted">
                    <span>Score: <span className="font-bold text-foreground">{acc.risk_score}</span></span>
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
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-heading-xl font-bold text-foreground tracking-tight">
              Fraud Operations Console
            </h1>
            <p className="mt-1 text-body-md text-foreground-muted">
              Real-time mule account detection & risk assessment
            </p>
          </div>
          <div className="flex flex-row items-center gap-3 flex-wrap">
            <Link to="/accounts" className="btn-secondary">
              Browse Accounts
            </Link>
            {hasEvaluation && (
              <button
                type="button"
                onClick={() => openDrawerForAccount(currentAccount!.account_id)}
                className="btn-primary"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                AI Summary
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch gap-3 max-w-3xl">
          <input
            type="text"
            value={accountInput}
            onChange={(e) => setAccountInput(e.target.value)}
            placeholder="Enter Account ID to evaluate..."
            className="input-field flex-1"
          />
          <button
            type="submit"
            disabled={isEvaluating}
            className="btn-primary whitespace-nowrap"
          >
            {isEvaluating ? 'Evaluating...' : 'Evaluate'}
          </button>
        </form>

        {isEvaluating && (
          <div className="glass flex items-center justify-center p-4 border border-accent/20 bg-accent/5">
            <p className="text-body-sm text-accent flex items-center gap-1">
              Analyzing account...
              <span className="ellipsis-dot">.</span>
              <span className="ellipsis-dot">.</span>
              <span className="ellipsis-dot">.</span>
            </p>
          </div>
        )}
        {evaluationError && !isEvaluating && (
          <div className="glass flex items-center justify-center p-4 border border-risk-critical/30 bg-risk-critical/5">
            <p className="text-body-sm text-risk-critical">Error: {evaluationError}</p>
          </div>
        )}

        <div className="flex-1 min-h-0">
          {renderEvaluationContent()}
        </div>
      </div>
    </PageShell>
  )
}

export default Dashboard