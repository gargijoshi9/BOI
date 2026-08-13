import { useState } from 'react'
import PageShell from '../components/PageShell'
import NetworkGraph from '../components/NetworkGraph'
import { formatINR } from '../components/DamageForecastWidget'
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
            <h1 className="text-heading-xl font-bold text-foreground tracking-tight">
              Transaction Network
            </h1>
            <p className="mt-1 text-body-md text-foreground-muted">
              Live fraud ring visualization & network analysis
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
              {isEvaluating ? 'Loading...' : 'Analyze'}
            </button>
          </form>
        </div>

        {currentAccount ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
              <StatCard value={currentAccount.network_connections?.nodes.length?.toString() ?? '0'} label="Nodes" icon="🔗" />
              <StatCard value={currentAccount.network_connections?.edges.length?.toString() ?? '0'} label="Edges" icon="➡️" />
              <StatCard value={formatINR(currentAccount.damage_metrics?.recoverable_amount ?? 0)} label="Recoverable" icon="🛡️" />
              <StatCard value={formatINR(currentAccount.damage_metrics?.in_transit_amount ?? 0)} label="In Transit" icon="💸" />
              <StatCard value={formatINR((currentAccount.damage_metrics?.recoverable_amount ?? 0) + (currentAccount.damage_metrics?.in_transit_amount ?? 0))} label="Total Exposure" icon="💰" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                <WidgetShell className="h-[560px] min-h-[560px]">
                  <NetworkGraph
                    networkConnections={currentAccount.network_connections}
                    centralAccountId={currentAccount.account_id}
                    height={500}
                  />
                </WidgetShell>
              </div>

              <div className="flex flex-col gap-5">
                <WidgetShell>
                  <WidgetTitle>Account Details</WidgetTitle>
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-row items-center justify-between py-2 border-b border-border/50">
                      <span className="text-body-sm text-foreground-muted">Account ID</span>
                      <span className="font-mono font-semibold text-body-md text-foreground">{currentAccount.account_id}</span>
                    </div>
                    <div className="flex flex-row items-center justify-between py-2 border-b border-border/50">
                      <span className="text-body-sm text-foreground-muted">Risk Score</span>
                      <span className="font-mono font-bold text-heading-sm text-foreground">{currentAccount.risk_score.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-row items-center justify-between py-2 border-b border-border/50">
                      <span className="text-body-sm text-foreground-muted">Risk Level</span>
                      <span className={`badge ${['Critical', 'High'].includes(currentAccount.risk_level) ? 'badge-critical' : ['Medium'].includes(currentAccount.risk_level) ? 'badge-medium' : 'badge-low'}`}>
                        {currentAccount.risk_level}
                      </span>
                    </div>
                    <div className="flex flex-row items-center justify-between py-2 border-b border-border/50">
                      <span className="text-body-sm text-foreground-muted">Kill Chain</span>
                      <span className="font-medium text-body-md text-amber-500">{currentAccount.kill_chain_stage}</span>
                    </div>
                    <div className="flex flex-row items-center justify-between py-2">
                      <span className="text-body-sm text-foreground-muted">Mode</span>
                      <span className={`badge ${currentAccount.is_simulated ? 'badge-high' : 'badge-teal'}`}>
                        {currentAccount.is_simulated ? 'Simulated' : 'Live Model'}
                      </span>
                    </div>
                  </div>
                </WidgetShell>

                <WidgetShell>
                  <WidgetTitle>Financial Impact</WidgetTitle>
                  <div className="mt-4 space-y-3">
                    <div className="flex flex-row items-center justify-between p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                      <span className="text-body-sm text-foreground-muted">Recoverable Now</span>
                      <span className="font-bold text-heading-sm text-green-500">
                        {formatINR(currentAccount.damage_metrics?.recoverable_amount ?? 0)}
                      </span>
                    </div>
                    <div className="flex flex-row items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                      <span className="text-body-sm text-foreground-muted">In Transit</span>
                      <span className="font-bold text-heading-sm text-amber-500">
                        {formatINR(currentAccount.damage_metrics?.in_transit_amount ?? 0)}
                      </span>
                    </div>
                    <div className="flex flex-row items-center justify-between p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 pt-3 border-t border-purple-500/20">
                      <span className="stat-label text-purple-400">Total Exposure</span>
                      <span className="font-mono font-bold text-xl text-purple-400">
                        {formatINR((currentAccount.damage_metrics?.recoverable_amount ?? 0) + (currentAccount.damage_metrics?.in_transit_amount ?? 0))}
                      </span>
                    </div>
                  </div>
                </WidgetShell>

                <WidgetShell>
                  <WidgetTitle>Network Stats</WidgetTitle>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-background-card border border-border/50 text-center">
                      <p className="font-mono font-bold text-2xl text-accent">{currentAccount.network_connections?.nodes.length ?? 0}</p>
                      <p className="stat-label">Nodes</p>
                    </div>
                    <div className="p-4 rounded-xl bg-background-card border border-border/50 text-center">
                      <p className="font-mono font-bold text-2xl text-accent">{currentAccount.network_connections?.edges.length ?? 0}</p>
                      <p className="stat-label">Edges</p>
                    </div>
                  </div>
                </WidgetShell>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <WidgetShell className="max-w-xl w-full text-center p-10 md:p-16">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center bg-accent/10 border border-accent/20">
                <svg className="h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <h2 className="text-heading-lg font-bold text-foreground mb-3">Analyze a Network</h2>
              <p className="text-body-md text-foreground-muted mb-8 max-w-sm mx-auto">
                Enter an Account ID above or select from recent evaluations to visualize the transaction network and fraud ring connections.
              </p>
              <div className="space-y-2 w-full max-w-xs mx-auto">
                {recentEvaluations.map((acc) => (
                  <button
                    key={acc.account_id}
                    onClick={() => handleAccountSelect(acc.account_id)}
                    className="w-full p-4 rounded-xl text-left transition-all hover:bg-background-cardHover border border-border/50"
                  >
                    <div className="flex flex-row items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-body-md text-foreground">{acc.account_id}</span>
                        {acc.is_simulated && <span className="badge badge-high">Sim</span>}
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
                ))}
                {recentEvaluations.length === 0 && (
                  <p className="text-body-md text-center py-8 text-foreground-muted">
                    No recent evaluations yet. Evaluate an account from Dashboard or Accounts page.
                  </p>
                )}
              </div>
            </WidgetShell>
          </div>
        )}
      </div>
    </PageShell>
  )
}

export default NetworkPage