import { useState } from 'react'
import PageShell from '../components/PageShell'
import NetworkGraph from '../components/NetworkGraph'
import { formatINR } from '../components/DamageForecastWidget'
import { useApp } from '../context/AppContext'

interface StatCardProps {
  value: string
  label: string
  icon?: React.ReactNode
  accentColor?: string
}

function StatCard({ value, label, icon, accentColor = '#22d3ee' }: StatCardProps) {
  return (
    <div className="glass flex flex-1 flex-col p-5 glow-cyan relative overflow-hidden" style={{ borderColor: `${accentColor}40` }}>
      <div className="absolute inset-0 opacity-5" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor})` }} />
      <div className="relative flex flex-row items-center justify-between">
        {icon && <div className="text-2xl opacity-80">{icon}</div>}
        <span className="text-2xl font-bold text-gradient-cyan-purple">{value}</span>
      </div>
      <span className="mt-3 text-xs uppercase tracking-wider relative" style={{ color: '#94a3b8' }}>
        {label}
      </span>
    </div>
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
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: '#f8fafc' }}>
              Transaction Network
            </h1>
            <p className="mt-1 text-sm" style={{ color: '#94a3b8' }}>
              Live fraud ring visualization & network analysis
            </p>
          </div>
          {/* Manual Account ID Input in Header */}
          <form onSubmit={handleManualEvaluate} className="flex flex-row items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={manualAccountId}
              onChange={(e) => setManualAccountId(e.target.value)}
              placeholder="Enter Account ID..."
              className="px-4 py-2 text-sm w-64 focus:outline-none"
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
              className="px-4 py-2 text-sm font-medium uppercase tracking-wider rounded-lg transition-all whitespace-nowrap"
              style={{
                background: isEvaluating ? 'rgba(34, 211, 238, 0.05)' : 'rgba(34, 211, 238, 0.1)',
                border: isEvaluating ? '1px solid rgba(34, 211, 238, 0.2)' : '1px solid rgba(34, 211, 238, 0.4)',
                color: isEvaluating ? '#22d3ee80' : '#22d3ee',
                cursor: isEvaluating ? 'not-allowed' : 'pointer',
              }}
            >
              {isEvaluating ? 'Loading...' : 'Analyze'}
            </button>
          </form>
        </div>

        {/* Content */}
        {currentAccount ? (
          <>
            {/* Stats Row for Selected Account */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard value={currentAccount.network_connections?.nodes.length?.toString() ?? '0'} label="Nodes" icon="🔗" accentColor="#22d3ee" />
              <StatCard value={currentAccount.network_connections?.edges.length?.toString() ?? '0'} label="Edges" icon="➡️" accentColor="#f97316" />
              <StatCard value={formatINR(currentAccount.damage_metrics?.recoverable_amount ?? 0)} label="Recoverable" icon="🛡️" accentColor="#22c55e" />
              <StatCard value={formatINR(currentAccount.damage_metrics?.in_transit_amount ?? 0)} label="In Transit" icon="💸" accentColor="#f97316" />
              <StatCard value={formatINR((currentAccount.damage_metrics?.recoverable_amount ?? 0) + (currentAccount.damage_metrics?.in_transit_amount ?? 0))} label="Total Exposure" icon="💰" accentColor="#a855f7" />
            </div>

            {/* Network Graph + Detail Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                <NetworkGraph
                  networkConnections={currentAccount.network_connections}
                  centralAccountId={currentAccount.account_id}
                  height={520}
                />
              </div>

              {/* Account Detail Panel */}
              <div className="glass flex flex-col p-5 space-y-5">
                <div>
                  <h3 className="text-xs font-medium uppercase mb-3" style={{ color: '#cbd5e1', letterSpacing: '0.18em' }}>
                    Account Details
                  </h3>
                  <div className="space-y-3">
                    <div className="flex flex-row items-center justify-between">
                      <span className="text-xs" style={{ color: '#94a3b8' }}>Account ID</span>
                      <span className="font-mono font-bold" style={{ color: '#f8fafc' }}>{currentAccount.account_id}</span>
                    </div>
                    <div className="flex flex-row items-center justify-between">
                      <span className="text-xs" style={{ color: '#94a3b8' }}>Risk Score</span>
                      <span className="font-bold text-xl text-gradient-cyan-purple">{currentAccount.risk_score}</span>
                    </div>
                    <div className="flex flex-row items-center justify-between">
                      <span className="text-xs" style={{ color: '#94a3b8' }}>Risk Level</span>
                      <span
                        className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded"
                        style={{
                          background: `${currentAccount.risk_level === 'Critical' ? '#ef4444' : currentAccount.risk_level === 'High' ? '#f97316' : currentAccount.risk_level === 'Medium' ? '#eab308' : '#22c55e'}33`,
                          color: currentAccount.risk_level === 'Critical' ? '#ef4444' : currentAccount.risk_level === 'High' ? '#f97316' : currentAccount.risk_level === 'Medium' ? '#eab308' : '#22c55e',
                        }}
                      >
                        {currentAccount.risk_level}
                      </span>
                    </div>
                    <div className="flex flex-row items-center justify-between">
                      <span className="text-xs" style={{ color: '#94a3b8' }}>Kill Chain</span>
                      <span className="font-medium" style={{ color: '#f97316' }}>{currentAccount.kill_chain_stage}</span>
                    </div>
                    <div className="flex flex-row items-center justify-between">
                      <span className="text-xs" style={{ color: '#94a3b8' }}>Mode</span>
                      <span className="font-medium" style={{ color: currentAccount.is_simulated ? '#ef4444' : '#22c55e' }}>
                        {currentAccount.is_simulated ? 'Simulated' : 'Live Model'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                  <h3 className="text-xs font-medium uppercase mb-3" style={{ color: '#cbd5e1', letterSpacing: '0.18em' }}>
                    Financial Impact
                  </h3>
                  <div className="space-y-3">
                    <div className="flex flex-row items-center justify-between p-3 rounded bg-green-500/5 border border-green-500/10">
                      <span className="text-xs" style={{ color: '#94a3b8' }}>Recoverable Now</span>
                      <span className="font-bold text-lg" style={{ color: '#22c55e' }}>
                        {formatINR(currentAccount.damage_metrics?.recoverable_amount ?? 0)}
                      </span>
                    </div>
                    <div className="flex flex-row items-center justify-between p-3 rounded bg-orange-500/5 border border-orange-500/10">
                      <span className="text-xs" style={{ color: '#94a3b8' }}>In Transit</span>
                      <span className="font-bold text-lg" style={{ color: '#f97316' }}>
                        {formatINR(currentAccount.damage_metrics?.in_transit_amount ?? 0)}
                      </span>
                    </div>
                    <div className="flex flex-row items-center justify-between p-3 rounded bg-purple-500/5 border border-purple-500/10 pt-3" style={{ borderTop: '1px solid rgba(168, 85, 247, 0.2)' }}>
                      <span className="text-xs uppercase tracking-wider" style={{ color: '#a855f7' }}>Total Exposure</span>
                      <span className="font-bold text-xl" style={{ color: '#a855f7' }}>
                        {formatINR((currentAccount.damage_metrics?.recoverable_amount ?? 0) + (currentAccount.damage_metrics?.in_transit_amount ?? 0))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                  <h3 className="text-xs font-medium uppercase mb-3" style={{ color: '#cbd5e1', letterSpacing: '0.18em' }}>
                    Network Stats
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded bg-white/5 text-center">
                      <p className="text-2xl font-bold text-gradient-cyan-purple">{currentAccount.network_connections?.nodes.length ?? 0}</p>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: '#94a3b8' }}>Nodes</p>
                    </div>
                    <div className="p-3 rounded bg-white/5 text-center">
                      <p className="text-2xl font-bold text-gradient-cyan-purple">{currentAccount.network_connections?.edges.length ?? 0}</p>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: '#94a3b8' }}>Edges</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Empty State - No account selected */}
            <div className="flex flex-1 items-center justify-center">
              <div className="glass flex flex-col items-center p-12 text-center max-w-md">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: 'rgba(34, 211, 238, 0.1)', border: '1px solid rgba(34, 211, 238, 0.3)' }}>
                  <span className="text-3xl">🔗</span>
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: '#f8fafc' }}>Analyze a Network</h2>
                <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>
                  Enter an Account ID above or select from recent evaluations to visualize the transaction network and fraud ring connections.
                </p>
                <div className="space-y-2 w-full max-w-xs">
                  {recentEvaluations.map((acc) => (
                    <button
                      key={acc.account_id}
                      onClick={() => handleAccountSelect(acc.account_id)}
                      className="w-full px-4 py-3 rounded-lg transition-all hover:bg-white/5 border text-left"
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
                            background: `${acc.risk_level === 'Critical' ? '#ef4444' : acc.risk_level === 'High' ? '#f97316' : acc.risk_level === 'Medium' ? '#eab308' : '#22c55e'}33`,
                            color: acc.risk_level === 'Critical' ? '#ef4444' : acc.risk_level === 'High' ? '#f97316' : acc.risk_level === 'Medium' ? '#eab308' : '#22c55e',
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
                  ))}
                  {recentEvaluations.length === 0 && (
                    <p className="text-sm text-center py-8" style={{ color: '#94a3b8' }}>
                      No recent evaluations yet. Evaluate an account from Dashboard or Accounts page.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}

export default NetworkPage