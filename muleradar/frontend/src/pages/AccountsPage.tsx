import { useEffect, useState, useMemo } from 'react'
import PageShell from '../components/PageShell'
import { RiskLevel, fetchAccounts, RiskEvaluationResponse } from '../api/client'
import { formatINR } from '../components/DamageForecastWidget'
import { useApp } from '../context/AppContext'

type RiskFilter = 'ALL' | RiskLevel

const FILTERS: RiskFilter[] = ['ALL', 'Critical', 'High', 'Medium', 'Low']

const RISK_COLORS: Record<RiskLevel, string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
}

const RISK_GLOWS: Record<RiskLevel, string> = {
  Critical: '0 0 12px rgba(239, 68, 68, 0.4)',
  High: '0 0 12px rgba(249, 115, 22, 0.4)',
  Medium: '0 0 12px rgba(234, 179, 8, 0.4)',
  Low: '0 0 12px rgba(34, 197, 94, 0.4)',
}

function AccountsPage() {
  const { currentAccount, evaluateAccount, recentEvaluations } = useApp()
  const [filter, setFilter] = useState<RiskFilter>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: keyof RiskEvaluationResponse; direction: 'asc' | 'desc' } | null>({ key: 'risk_score', direction: 'desc' })
  const [accounts, setAccounts] = useState<RiskEvaluationResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    async function loadAccounts() {
      try {
        setLoading(true)
        const data = await fetchAccounts(200)
        setAccounts(data)
      } catch (err) {
        setError('Failed to fetch accounts from backend')
      } finally {
        setLoading(false)
      }
    }
    loadAccounts()
  }, [])

  const filteredAccounts = useMemo(() => {
    let result = [...accounts]

    // Apply risk filter
    if (filter !== 'ALL') {
      result = result.filter((r) => r.risk_level === filter)
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      result = result.filter((r) =>
        r.account_id.toLowerCase().includes(query) ||
        r.kill_chain_stage.toLowerCase().includes(query)
      )
    }

    // Apply sort
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key]
        const bVal = b[sortConfig.key]
        if (aVal === undefined || bVal === undefined) return 0
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortConfig.direction === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal)
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
        }
        return 0
      })
    }

    return result
  }, [accounts, filter, searchQuery, sortConfig])

  const stats = useMemo(() => ({
    total: accounts.length,
    critical: accounts.filter((a) => a.risk_level === 'Critical').length,
    high: accounts.filter((a) => a.risk_level === 'High').length,
    medium: accounts.filter((a) => a.risk_level === 'Medium').length,
    low: accounts.filter((a) => a.risk_level === 'Low').length,
    totalExposure: accounts.reduce((sum, a) => sum + (a.damage_metrics?.recoverable_amount ?? 0) + (a.damage_metrics?.in_transit_amount ?? 0), 0),
    simulated: accounts.filter((a) => a.is_simulated).length,
  }), [accounts])

  function handleSort(key: keyof RiskEvaluationResponse) {
    setSortConfig((prev) => ({
      key,
      direction: prev?.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }))
  }

  async function handleRowClick(account: RiskEvaluationResponse) {
    setDetailLoading(true)
    try {
      // Use global evaluateAccount to update currentAccount across all pages
      await evaluateAccount(account.account_id)
      setShowDetail(true)
    } catch (err) {
      console.error('Failed to fetch account details:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <PageShell>
      <div className="flex flex-1 flex-col gap-6 overflow-hidden p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: '#f8fafc' }}>
              Accounts Directory
            </h1>
            <p className="mt-1 text-sm" style={{ color: '#94a3b8' }}>
              {filteredAccounts.length} of {accounts.length} accounts • {stats.simulated} simulated
            </p>
          </div>
          <div className="flex flex-row items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search accounts..."
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
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="glass p-4 flex flex-row items-center gap-3" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <div className="p-2 rounded" style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
              <span className="text-xl">🚨</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#94a3b8' }}>Critical</p>
              <p className="text-xl font-bold" style={{ color: '#ef4444' }}>{stats.critical}</p>
            </div>
          </div>
          <div className="glass p-4 flex flex-row items-center gap-3" style={{ borderColor: 'rgba(249, 115, 22, 0.3)' }}>
            <div className="p-2 rounded" style={{ background: 'rgba(249, 115, 22, 0.15)' }}>
              <span className="text-xl">⚠️</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#94a3b8' }}>High</p>
              <p className="text-xl font-bold" style={{ color: '#f97316' }}>{stats.high}</p>
            </div>
          </div>
          <div className="glass p-4 flex flex-row items-center gap-3" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
            <div className="p-2 rounded" style={{ background: 'rgba(234, 179, 8, 0.15)' }}>
              <span className="text-xl">🟡</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#94a3b8' }}>Medium</p>
              <p className="text-xl font-bold" style={{ color: '#eab308' }}>{stats.medium}</p>
            </div>
          </div>
          <div className="glass p-4 flex flex-row items-center gap-3" style={{ borderColor: 'rgba(34, 197, 94, 0.3)' }}>
            <div className="p-2 rounded" style={{ background: 'rgba(34, 197, 94, 0.15)' }}>
              <span className="text-xl">✅</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#94a3b8' }}>Low</p>
              <p className="text-xl font-bold" style={{ color: '#22c55e' }}>{stats.low}</p>
            </div>
          </div>
          <div className="glass p-4 flex flex-row items-center gap-3" style={{ borderColor: 'rgba(168, 85, 247, 0.3)' }}>
            <div className="p-2 rounded" style={{ background: 'rgba(168, 85, 247, 0.15)' }}>
              <span className="text-xl">💰</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#94a3b8' }}>Total Exposure</p>
              <p className="text-lg font-bold" style={{ color: '#a855f7' }}>{formatINR(stats.totalExposure)}</p>
            </div>
          </div>
          <div className="glass p-4 flex flex-row items-center gap-3" style={{ borderColor: 'rgba(34, 211, 238, 0.3)' }}>
            <div className="p-2 rounded" style={{ background: 'rgba(34, 211, 238, 0.15)' }}>
              <span className="text-xl">🏦</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#94a3b8' }}>Total Accounts</p>
              <p className="text-xl font-bold text-gradient-cyan-purple">{stats.total}</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-row gap-2 overflow-x-auto pb-2">
          {FILTERS.map((f) => {
            const isActive = f === filter
            const count = f === 'ALL' ? stats.total : stats[f.toLowerCase() as keyof typeof stats]
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`flex flex-row items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-wider whitespace-nowrap rounded-full transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 text-cyan-400'
                    : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                {f}
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-white/10 text-white/60'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="flex-1 glass flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm" style={{ color: '#22d3ee' }}>
                Loading directory...
                <span className="ellipsis-dot ml-1">.</span>
                <span className="ellipsis-dot">.</span>
                <span className="ellipsis-dot">.</span>
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm" style={{ color: '#94a3b8' }}>No accounts match your filters</p>
            </div>
          ) : (
            <>
              <div className="flex flex-row items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                <div className="flex flex-row items-center gap-2 text-xs" style={{ color: '#94a3b8', letterSpacing: '0.18em' }}>
                  <span className="flex-1 min-w-[140px]" onClick={() => handleSort('account_id')} style={{ cursor: 'pointer' }}>
                    Account ID {sortConfig?.key === 'account_id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </span>
                  <span className="w-24 text-center" onClick={() => handleSort('risk_score')} style={{ cursor: 'pointer' }}>
                    Score {sortConfig?.key === 'risk_score' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </span>
                  <span className="w-28 text-center" onClick={() => handleSort('risk_level')} style={{ cursor: 'pointer' }}>
                    Level {sortConfig?.key === 'risk_level' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </span>
                  <span className="w-36 text-center" onClick={() => handleSort('kill_chain_stage')} style={{ cursor: 'pointer' }}>
                    Stage {sortConfig?.key === 'kill_chain_stage' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </span>
                  <span className="w-40 text-center" onClick={() => handleSort('damage_metrics')} style={{ cursor: 'pointer' }}>
                    Recoverable {sortConfig?.key === 'damage_metrics' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </span>
                  <span className="w-24 text-center">
                    Network
                  </span>
                  <span className="w-24 text-center">
                    Actions
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {filteredAccounts.map((row) => (
                      <tr
                        key={row.account_id}
                        onClick={() => handleRowClick(row)}
                        className="cursor-pointer hover:bg-white/5 transition-colors border-b"
                        style={{ borderColor: 'rgba(255, 255, 255, 0.04)' }}
                      >
                        <td className="px-6 py-4 font-mono min-w-[140px]">
                          <span className="flex flex-row items-center gap-2" style={{ color: '#22d3ee' }}>
                            {row.account_id}
                            {row.is_simulated && (
                              <span
                                title="Simulated result - no trained model artifacts matched this account"
                                className="inline-flex items-center bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-400 rounded"
                              >
                                Sim
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 w-24 text-center tabular-nums font-bold" style={{ color: '#f8fafc' }}>
                          {row.risk_score}
                        </td>
                        <td className="px-6 py-4 w-28 text-center">
                          <span
                            className="inline-flex items-center px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded"
                            style={{
                              backgroundColor: `${RISK_COLORS[row.risk_level]}33`,
                              color: RISK_COLORS[row.risk_level],
                              boxShadow: RISK_GLOWS[row.risk_level],
                            }}
                          >
                            {row.risk_level}
                          </span>
                        </td>
                        <td className="px-6 py-4 w-36 text-center" style={{ color: '#94a3b8' }}>
                          {row.kill_chain_stage}
                        </td>
                        <td className="px-6 py-4 w-40 text-center tabular-nums font-medium" style={{ color: '#a855f7' }}>
                          {formatINR(row.damage_metrics?.recoverable_amount ?? 0)}
                        </td>
                        <td className="px-6 py-4 w-24 text-center text-xs" style={{ color: '#94a3b8' }}>
                          {row.network_connections?.nodes.length ?? 0} nodes
                        </td>
                        <td className="px-6 py-4 w-24 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRowClick(row)
                            }}
                            className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider rounded transition-all"
                            style={{
                              background: 'rgba(34, 211, 238, 0.1)',
                              border: '1px solid rgba(34, 211, 238, 0.3)',
                              color: '#22d3ee',
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Recent Evaluations Quick Access */}
        {recentEvaluations.length > 0 && (
          <div className="glass flex flex-col p-5">
            <h3 className="text-xs font-medium uppercase mb-4" style={{ color: '#cbd5e1', letterSpacing: '0.18em' }}>
              Recent Evaluations
            </h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {recentEvaluations.map((acc) => (
                <button
                  key={acc.account_id}
                  onClick={() => handleRowClick({ 
                    account_id: acc.account_id, 
                    risk_score: acc.risk_score, 
                    risk_level: acc.risk_level as RiskLevel, 
                    kill_chain_stage: acc.kill_chain_stage as any, 
                    damage_metrics: { recoverable_amount: 0, in_transit_amount: 0, is_estimated: true }, 
                    is_simulated: acc.is_simulated,
                    shap_explanation: [],
                    network_connections: { nodes: [], edges: [] }
                  })}
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
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {showDetail && currentAccount && (
        <div
          className="fixed inset-0 z-50 flex flex-row justify-end"
          onClick={() => setShowDetail(false)}
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDetail(false)} />
          <div
            className="relative flex flex-col w-full max-w-md h-full bg-black/95 backdrop-blur-2xl border-l border-white/10 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'slideIn 300ms ease' }}
          >
            <div className="flex flex-row items-center justify-between p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
              <h2 className="text-lg font-bold" style={{ color: '#22d3ee' }}>Account Detail</h2>
              <button
                onClick={() => setShowDetail(false)}
                className="text-xl font-medium p-1 rounded hover:bg-white/10 transition-colors"
                style={{ color: '#cbd5e1' }}
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-6">
              {detailLoading && (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm" style={{ color: '#22d3ee' }}>
                    Loading details...
                    <span className="ellipsis-dot ml-1">.</span>
                    <span className="ellipsis-dot">.</span>
                    <span className="ellipsis-dot">.</span>
                  </p>
                </div>
              )}

              {/* Header */}
              <div className="flex flex-row items-center justify-between">
                <span className="font-mono text-xl" style={{ color: '#f8fafc' }}>{currentAccount.account_id}</span>
                <div className="flex flex-row items-center gap-2">
                  <span
                    className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${
                      currentAccount.is_simulated ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {currentAccount.is_simulated ? 'Simulated' : 'Live'}
                  </span>
                </div>
              </div>

              {/* Risk Score */}
              <div className="glass p-5 rounded-xl" style={{ borderColor: 'rgba(34, 211, 238, 0.3)' }}>
                <div className="flex flex-row items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Risk Score</p>
                    <p className="text-5xl font-extrabold text-gradient-cyan-purple">{currentAccount.risk_score}</p>
                    <p className="text-xs" style={{ color: '#94a3b8' }}>out of 1000</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Risk Level</p>
                    <span
                      className="inline-block px-3 py-1 text-sm font-bold uppercase tracking-wider rounded"
                      style={{
                        backgroundColor: `${RISK_COLORS[currentAccount.risk_level]}33`,
                        color: RISK_COLORS[currentAccount.risk_level],
                        boxShadow: RISK_GLOWS[currentAccount.risk_level],
                      }}
                    >
                      {currentAccount.risk_level}
                    </span>
                  </div>
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="glass p-4">
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Kill Chain</p>
                  <p className="font-bold" style={{ color: '#f97316' }}>{currentAccount.kill_chain_stage}</p>
                </div>
                <div className="glass p-4">
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Network Nodes</p>
                  <p className="font-bold text-gradient-cyan-purple">{currentAccount.network_connections?.nodes.length ?? 0}</p>
                </div>
                <div className="glass p-4">
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Edges</p>
                  <p className="font-bold text-gradient-cyan-purple">{currentAccount.network_connections?.edges.length ?? 0}</p>
                </div>
                <div className="glass p-4">
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>In Transit</p>
                  <p className="font-bold" style={{ color: '#f97316' }}>{formatINR(currentAccount.damage_metrics?.in_transit_amount ?? 0)}</p>
                </div>
              </div>

              {/* Financial Impact */}
              <div className="glass p-5 rounded-xl" style={{ borderColor: 'rgba(168, 85, 247, 0.3)' }}>
                <h3 className="text-xs font-medium uppercase mb-4" style={{ color: '#cbd5e1', letterSpacing: '0.18em' }}>
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
                {currentAccount.damage_metrics?.is_estimated && (
                  <p className="mt-3 text-[11px] leading-snug" style={{ color: '#cbd5e1' }}>
                    {currentAccount.damage_metrics.estimation_note ?? 'Estimated figures - not verified against real transaction records.'}
                  </p>
                )}
              </div>

              {/* SHAP Preview */}
              {currentAccount.shap_explanation && currentAccount.shap_explanation.length > 0 && (
                <div className="glass p-5">
                  <h3 className="text-xs font-medium uppercase mb-4" style={{ color: '#cbd5e1', letterSpacing: '0.18em' }}>
                    Top Risk Drivers
                  </h3>
                  <div className="space-y-3">
                    {currentAccount.shap_explanation
                      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
                      .slice(0, 4)
                      .map((f) => {
                        const isPositive = f.contribution > 0
                        const maxAbs = Math.max(...currentAccount.shap_explanation!.map((ff) => Math.abs(ff.contribution)))
                        const widthPct = Math.min(100, (Math.abs(f.contribution) / maxAbs) * 100)
                        return (
                          <div key={f.feature} className="flex flex-col gap-1">
                            <div className="flex flex-row items-center justify-between">
                              <span className="text-xs truncate max-w-[160px]" style={{ color: '#94a3b8' }}>{f.feature}</span>
                              <span className="text-xs font-bold tabular-nums" style={{ color: isPositive ? '#22d3ee' : '#ef4444' }}>
                                {f.contribution > 0 ? '+' : ''}{f.contribution.toFixed(3)}
                              </span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded overflow-hidden">
                              <div
                                className="h-full transition-all duration-500"
                                style={{
                                  width: `${widthPct}%`,
                                  background: isPositive ? 'linear-gradient(90deg, #22d3ee, #a855f7)' : 'linear-gradient(90deg, #ef4444, #f97316)',
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                  </div>
                  <p className="mt-3 text-[10px] text-center" style={{ color: '#94a3b8' }}>
                    View full SHAP analysis on the SHAP page →
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-row gap-3 pt-3 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                <button className="flex-1 py-3 text-sm font-medium uppercase tracking-wider rounded-lg transition-all" style={{
                  background: 'rgba(34, 211, 238, 0.1)',
                  border: '1px solid rgba(34, 211, 238, 0.4)',
                  color: '#22d3ee',
                }}>
                  Re-evaluate
                </button>
                <button className="flex-1 py-3 text-sm font-medium uppercase tracking-wider rounded-lg transition-all" style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                }}>
                  AI Summary
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}

export default AccountsPage