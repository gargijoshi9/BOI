import { useState } from 'react'
import PageShell from '../components/PageShell'
import NetworkGraph from '../components/NetworkGraph'
import { useApp } from '../context/AppContext'
import { WidgetShell, WidgetTitle } from '../components/RiskScoreWidget'

function StatCard({ value, label, icon }: { value: string; label: string; icon?: React.ReactNode }) {
  return (
    <WidgetShell className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[rgba(0,212,170,0.03)] to-transparent" />
      <div className="relative flex flex-col">
        <div className="flex flex-row items-center justify-between">
          {icon && <div className="text-2xl opacity-80">{icon}</div>}
          <span className="font-mono font-bold text-2xl text-foreground">{value}</span>
        </div>
        <span className="mt-2 stat-label">{label}</span>
      </div>
    </WidgetShell>
  )
}

function NetworkPage() {
  const { currentAccount, evaluateAccount, isEvaluating, recentEvaluations } = useApp()
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

  return (
    <PageShell>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-accent/10 border border-accent/20 text-accent text-xs font-semibold tracking-wide uppercase">
                Interactive Visualization
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mt-2 tracking-tight">
              Fraud Ring Network
            </h1>
            <p className="mt-1 text-body-sm text-foreground-muted">
              Live transaction graph & network topology analysis
            </p>
          </div>
          <form onSubmit={handleManualEvaluate} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <input
              type="text"
              value={manualAccountId}
              onChange={(e) => setManualAccountId(e.target.value)}
              placeholder="Enter Account ID..."
              className="input-field flex-1 bg-background/50 border border-border/60 text-xs text-foreground placeholder-foreground-muted focus:outline-none focus:border-accent rounded-xl w-full sm:w-64"
            />
            <button
              type="submit"
              disabled={isEvaluating}
              className="px-6 py-2.5 rounded-xl bg-accent text-navy-950 hover:bg-accent-hover font-semibold text-xs transition-all shadow-glow-teal whitespace-nowrap"
            >
              {isEvaluating ? 'Evaluating...' : 'Analyze Network'}
            </button>
          </form>
        </div>

        {isEvaluating && (
          <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 text-accent text-xs flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Rendering network topology...</span>
          </div>
        )}

        {currentAccount ? (
          <div className="rounded-2xl border border-accent/30 bg-background-card/90 backdrop-blur-xl p-6 shadow-2xl space-y-5 animate-fade-in flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
              <div>
                <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Active Evaluation Focus</span>
                <h2 className="text-xl font-bold font-mono text-foreground mt-0.5">{currentAccount.account_id}</h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Risk Level</span>
                  <span className={`badge mt-1 ${['Critical', 'High'].includes(currentAccount.risk_level) ? 'badge-critical' : ['Medium'].includes(currentAccount.risk_level) ? 'badge-medium' : 'badge-low'}`}>
                    {currentAccount.risk_level}
                  </span>
                </div>
                <div className="h-8 w-px bg-border/50 mx-2"></div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Risk Score</span>
                  <span className="font-mono font-bold text-lg text-foreground mt-0.5">{currentAccount.risk_score}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-5 flex-1">
              {/* Network Stats Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-background-card/50 border border-border/40 relative group hover:border-accent/30 transition-colors flex flex-col">
                  <span className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">Topology Nodes</span>
                  <p className="mt-1 font-mono font-bold text-2xl text-foreground">{currentAccount.network_connections?.nodes.length ?? 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-background-card/50 border border-border/40 relative group hover:border-accent/30 transition-colors flex flex-col">
                  <span className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">Topology Edges</span>
                  <p className="mt-1 font-mono font-bold text-2xl text-foreground">{currentAccount.network_connections?.edges.length ?? 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-background-card/50 border border-border/40 relative group flex flex-col justify-center">
                  <span className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">Account Mode</span>
                  <div className="mt-1">
                    <span className={`badge ${currentAccount.is_simulated ? 'badge-high' : 'badge-teal'} text-[10px]`}>
                      {currentAccount.is_simulated ? 'Simulated' : 'Live Model'}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-background-card/50 border border-border/40 relative group flex flex-col justify-center">
                  <span className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">Human Review</span>
                  <span className={`text-sm mt-1 font-semibold ${currentAccount.human_review?.requires_review ? 'text-amber-500' : 'text-emerald-400'}`}>
                    {currentAccount.human_review?.requires_review ? 'Required' : 'Not Required'}
                  </span>
                </div>
              </div>

              {/* Main Graph Container */}
              <div className="rounded-2xl border border-border/50 bg-background/20 relative overflow-hidden min-h-[500px] flex flex-col p-2">
                {/* Subtle grid background to look high-tech */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiLz4KPGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz4KPC9zdmc+')] pointer-events-none opacity-50"></div>
                
                <div className="flex-1 relative z-10 w-full h-full">
                  <NetworkGraph
                    networkConnections={currentAccount.network_connections}
                    centralAccountId={currentAccount.account_id}
                    height={500}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="rounded-2xl border border-border/50 bg-background-card/80 backdrop-blur-xl p-10 md:p-16 max-w-xl w-full text-center shadow-xl relative overflow-hidden animate-fade-in">
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center bg-accent/10 border border-accent/20 relative z-10 shadow-[0_0_15px_rgba(0,212,170,0.2)]">
                <svg className="h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              
              <h2 className="text-2xl font-bold text-foreground mb-3 relative z-10 tracking-tight">Initiate Network Analysis</h2>
              <p className="text-sm text-foreground-muted mb-8 max-w-sm mx-auto relative z-10 leading-relaxed">
                Enter an Account ID above or select from recent evaluations to visualize the transaction network, isolate counterparty nodes, and map fraud ring connections.
              </p>
              
              <div className="space-y-3 w-full max-w-sm mx-auto relative z-10">
                <div className="text-left mb-2">
                  <span className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Recent Evaluations</span>
                </div>
                {recentEvaluations.slice(0, 3).map((acc) => (
                  <button
                    key={acc.account_id}
                    onClick={() => handleAccountSelect(acc.account_id)}
                    className="w-full p-4 rounded-xl text-left transition-all bg-background/50 hover:bg-background-cardHover border border-border/40 hover:border-accent/40 group flex justify-between items-center"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground group-hover:text-accent transition-colors">{acc.account_id}</span>
                        {acc.is_simulated && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-500 uppercase">SIM</span>}
                      </div>
                      <span className="text-[10px] text-foreground-muted uppercase">Risk Score: {acc.risk_score}</span>
                    </div>
                    <span className={`badge ${['Critical', 'High'].includes(acc.risk_level) ? 'badge-critical' : ['Medium'].includes(acc.risk_level) ? 'badge-medium' : 'badge-low'}`}>
                      {acc.risk_level}
                    </span>
                  </button>
                ))}
                {recentEvaluations.length === 0 && (
                  <div className="p-6 rounded-xl border border-dashed border-border/50 text-center">
                    <p className="text-xs text-foreground-muted">
                      No evaluations run in current session.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}

export default NetworkPage