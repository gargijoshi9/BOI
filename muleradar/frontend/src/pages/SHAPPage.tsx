import { useState } from 'react'
import PageShell from '../components/PageShell'
import ShapWidget from '../components/ShapWidget'
import { useApp } from '../context/AppContext'
import { WidgetShell, WidgetTitle } from '../components/RiskScoreWidget'
import InvestigationReportModal from '../components/InvestigationReportModal'

function SHAPPage() {
  const { currentAccount, evaluateAccount, isEvaluating, evaluationError, recentEvaluations } = useApp()
  const [manualAccountId, setManualAccountId] = useState('')

  async function handleAccountSelect(accountId: string) {
    await evaluateAccount(accountId)
  }

  async function handleManualEvaluate(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = manualAccountId.trim()
    if (!trimmed) return
    await handleAccountSelect(trimmed)
  }

  const [isReportOpen, setIsReportOpen] = useState(false)
  const shapFeatures = currentAccount?.shap_explanation ?? []

  return (
    <PageShell>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-heading-xl font-bold text-foreground tracking-tight">
              SHAP Explainability
            </h1>
            <p className="mt-1 text-body-md text-foreground-muted">
              Feature importance breakdown for the evaluated account
            </p>
          </div>
          <form onSubmit={handleManualEvaluate} className="flex flex-row items-center gap-3 w-full sm:w-auto">
            <input
              type="text"
              value={manualAccountId}
              onChange={(e) => setManualAccountId(e.target.value)}
              placeholder="Enter Account ID..."
              className="input-field w-64"
            />
            <button
              type="submit"
              disabled={isEvaluating}
              className="btn-primary whitespace-nowrap"
            >
              {isEvaluating ? 'Loading...' : 'Evaluate'}
            </button>
          </form>
        </div>

        <div className="flex flex-row gap-5 lg:gap-6">
          <div className="hidden lg:block w-[340px] flex-shrink-0">
            <WidgetShell className="sticky top-24 h-[calc(100vh-8rem)] flex flex-col">
              <WidgetTitle>Select Account</WidgetTitle>

              <form onSubmit={handleManualEvaluate} className="mt-4 flex flex-row gap-2 mb-5">
                <input
                  type="text"
                  value={manualAccountId}
                  onChange={(e) => setManualAccountId(e.target.value)}
                  placeholder="Or enter Account ID..."
                  className="input-field flex-1"
                />
                <button
                  type="submit"
                  disabled={isEvaluating}
                  className="btn-primary whitespace-nowrap"
                >
                  {isEvaluating ? 'Loading...' : 'Evaluate'}
                </button>
              </form>

              <div className="flex-1 overflow-y-auto space-y-2">
                {recentEvaluations.map((acc) => (
                  <button
                    key={acc.account_id}
                    onClick={() => handleAccountSelect(acc.account_id)}
                    className={`w-full p-4 rounded-xl text-left transition-all border ${
                      currentAccount?.account_id === acc.account_id
                        ? 'bg-accent/5 border-accent/30'
                        : 'border-border/50 hover:bg-background-cardHover'
                    }`}
                    disabled={isEvaluating}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-body-md text-foreground">{acc.account_id}</span>
                      <span className={`badge ${acc.is_simulated ? 'badge-high' : 'badge-teal'}`}>
                        {acc.is_simulated ? 'Simulated' : 'Live'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-body-sm text-foreground-muted">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-risk-critical" />
                        Risk: {acc.risk_score.toLocaleString()}/1000
                      </span>
                      <span>{acc.kill_chain_stage}</span>
                    </div>
                  </button>
                ))}
                {recentEvaluations.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-body-md text-foreground-muted">
                      No recent evaluations yet. Evaluate an account from Dashboard or Accounts page.
                    </p>
                  </div>
                )}
              </div>
            </WidgetShell>
          </div>

          <div className="flex flex-1 flex-col min-w-0">
            {currentAccount ? (
              <>
                <WidgetShell className="mb-5">
                  <ShapWidget shapExplanation={shapFeatures} />
                </WidgetShell>

                <WidgetShell>
                  <div className="flex items-center justify-between">
                    <WidgetTitle>Account Context</WidgetTitle>
                    <button
                      onClick={() => setIsReportOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all border border-accent/50 text-accent hover:bg-accent/10 shadow-lg hover:scale-105"
                    >
                      <span>📄</span> Generate Investigation Report
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-background-card border border-border/50">
                      <span className="stat-label">Risk Score</span>
                      <p className="mt-1 font-mono font-bold text-xl text-foreground">{currentAccount.risk_score.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-background-card border border-border/50">
                      <span className="stat-label">Risk Level</span>
                      <p className="mt-1 font-bold text-xl">
                        <span className={`badge ${['Critical', 'High'].includes(currentAccount.risk_level) ? 'badge-critical' : ['Medium'].includes(currentAccount.risk_level) ? 'badge-medium' : 'badge-low'}`}>
                          {currentAccount.risk_level}
                        </span>
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-background-card border border-border/50">
                      <span className="stat-label">Kill Chain Stage</span>
                      <p className="mt-1 font-bold text-xl text-amber-500">{currentAccount.kill_chain_stage}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-background-card border border-border/50">
                      <span className="stat-label">Mode</span>
                      <p className="mt-1 font-bold text-xl">
                        <span className={`badge ${currentAccount.is_simulated ? 'badge-high' : 'badge-teal'}`}>
                          {currentAccount.is_simulated ? 'Simulated' : 'Live Model'}
                        </span>
                      </p>
                    </div>
                  </div>
                </WidgetShell>

                {/* PDF Investigation Report Modal */}
                <InvestigationReportModal
                  account={currentAccount}
                  isOpen={isReportOpen}
                  onClose={() => setIsReportOpen(false)}
                />
              </>
            ) : (
              <WidgetShell className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center bg-accent/10 border border-accent/20">
                  <svg className="h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 20V10" />
                    <path d="M12 20V4" />
                    <path d="M6 20v-6" />
                  </svg>
                </div>
                <h3 className="text-heading-lg font-bold text-foreground mb-3">Select an Account</h3>
                <p className="text-body-md text-foreground-muted text-center max-w-md">
                  Choose an account from the list or enter an Account ID manually to view SHAP feature importance.
                </p>
              </WidgetShell>
            )}

            {isEvaluating && (
              <WidgetShell className="mt-5">
                <div className="glass flex items-center justify-center p-8 border border-accent/20">
                  <p className="text-body-md text-accent flex items-center gap-1">
                    Loading SHAP explanation
                    <span className="ellipsis-dot">.</span>
                    <span className="ellipsis-dot">.</span>
                    <span className="ellipsis-dot">.</span>
                  </p>
                </div>
              </WidgetShell>
            )}

            {evaluationError && (
              <WidgetShell className="mt-5">
                <div className="glass p-4 border border-risk-critical/30 bg-risk-critical/5">
                  <p className="text-body-sm text-risk-critical">{evaluationError}</p>
                </div>
              </WidgetShell>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}

export default SHAPPage