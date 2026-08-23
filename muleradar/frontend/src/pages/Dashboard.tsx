import { FormEvent, useState, useEffect } from 'react'
import PageShell from '../components/PageShell'
import RiskScoreWidget from '../components/RiskScoreWidget'
import { Link } from 'react-router-dom'
import { fetchAccounts, resolveReview } from '../api/client'
import { useDrawer } from '../context/DrawerContext'
import { useApp } from '../context/AppContext'

interface AggregatedStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  flagged: number;
  segments: Record<string, number>;
  occupations: Record<string, number>;
  avgModelProbability: number;
  recentCriticals: any[];
}

function Dashboard() {
  const { currentAccount, evaluateAccount, isEvaluating, evaluationError, recentEvaluations } = useApp()
  const { openDrawerForAccount } = useDrawer()
  const [accountInput, setAccountInput] = useState('')
  const [globalStats, setGlobalStats] = useState<AggregatedStats | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  
  const [actionModal, setActionModal] = useState<{ isOpen: boolean; decision: 'confirm_mule' | 'clear' | 'escalate'; reviewerName: string; note: string } | null>(null)

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  useEffect(() => {
    fetchAccounts(15000, true).then((data) => {
      const stats: AggregatedStats = { 
        total: 0, critical: 0, high: 0, medium: 0, low: 0, 
        flagged: 0, segments: {}, occupations: {}, avgModelProbability: 0, recentCriticals: [] 
      }
      let sumProb = 0
      data.forEach((acc: any) => {
        stats.total++
        if (acc.risk_level === 'Critical') {
          stats.critical++
          stats.recentCriticals.push(acc)
        }
        else if (acc.risk_level === 'High') stats.high++
        else if (acc.risk_level === 'Medium') stats.medium++
        else if (acc.risk_level === 'Low') stats.low++

        if (acc.human_review?.requires_review || acc.risk_level === 'Critical' || acc.risk_level === 'High') {
          stats.flagged++
        }

        sumProb += acc.model_probability || 0

        if (acc.risk_level === 'Critical' || acc.risk_level === 'High') {
          const seg = acc.account_type || 'Unknown'
          stats.segments[seg] = (stats.segments[seg] || 0) + 1
          
          const occ = acc.occupation || 'Unknown'
          stats.occupations[occ] = (stats.occupations[occ] || 0) + 1
        }
      })
      if (stats.total > 0) {
        stats.avgModelProbability = sumProb / stats.total
      }
      stats.recentCriticals = stats.recentCriticals.sort((a, b) => b.risk_score - a.risk_score).slice(0, 5)
      setGlobalStats(stats)
    }).catch(console.error)
  }, [])

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

  const renderDoughnut = () => {
    if (!globalStats || globalStats.total === 0) return (
      <div className="card flex items-center justify-center p-6 h-full border border-slate-800 bg-[#0b0f19]">
        <span className="text-slate-500">Loading risk breakdown...</span>
      </div>
    )
    const { critical, high, medium, low, total } = globalStats
    const criticalPct = (critical / total) * 100
    
    const r = 40
    const cx = 50
    const cy = 50
    const c = 2 * Math.PI * r
    
    const pct1 = (low / total) * 100
    const pct2 = (medium / total) * 100
    const pct3 = (high / total) * 100
    const pct4 = (critical / total) * 100

    const offset2 = (pct1 / 100) * c
    const offset3 = ((pct1 + pct2) / 100) * c
    const offset4 = ((pct1 + pct2 + pct3) / 100) * c

    return (
      <div className="card flex flex-col p-6 border border-slate-800 bg-[#121620] h-full">
        <h3 className="text-xs font-bold text-slate-100 mb-6">Risk Score Distribution</h3>
        <div className="flex flex-row items-center justify-between flex-1">
          <div className="relative w-32 h-32 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="#22c55e" strokeWidth="12" strokeDasharray={`${(pct1/100)*c} ${c}`} strokeDashoffset={0} />
              <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="#eab308" strokeWidth="12" strokeDasharray={`${(pct2/100)*c} ${c}`} strokeDashoffset={-offset2} />
              <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="#f97316" strokeWidth="12" strokeDasharray={`${(pct3/100)*c} ${c}`} strokeDashoffset={-offset3} />
              <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="#ef4444" strokeWidth="12" strokeDasharray={`${(pct4/100)*c} ${c}`} strokeDashoffset={-offset4} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-red-500">{criticalPct.toFixed(1)}%</span>
              <span className="text-[9px] text-slate-400">Critical</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 flex-1 ml-4 justify-center">
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-xs text-slate-300">Critical</span></div><span className="font-mono text-slate-100 text-xs">{critical.toLocaleString()}</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500"></div><span className="text-xs text-slate-300">High</span></div><span className="font-mono text-slate-100 text-xs">{high.toLocaleString()}</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500"></div><span className="text-xs text-slate-300">Medium</span></div><span className="font-mono text-slate-100 text-xs">{medium.toLocaleString()}</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="text-xs text-slate-300">Low</span></div><span className="font-mono text-slate-100 text-xs">{low.toLocaleString()}</span></div>
          </div>
        </div>
      </div>
    )
  }

  const renderHorizontalBars = (title: string, data: Record<string, number>, colorClass: string) => {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxVal = entries[0]?.[1] || 1;

    return (
      <div className="card flex flex-col p-6 border border-slate-800 bg-[#121620] h-full">
        <h3 className="text-xs font-bold text-slate-100 mb-6">{title}</h3>
        <div className="flex flex-col gap-4 flex-1 justify-center">
          {entries.length === 0 ? (
            <span className="text-slate-500 text-xs">No high risk data</span>
          ) : (
            entries.map(([label, count]) => (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 capitalize truncate pr-4">{label}</span>
                  <span className="font-mono text-slate-100">{count}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${(count / maxVal) * 100}%` }}></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // Render Trend Line removed to prevent static hallucination

  function renderEmptyStateDashboard() {
    if (!globalStats) return (
      <div className="flex items-center justify-center p-20">
        <span className="text-slate-500">Loading Dashboard Data...</span>
      </div>
    );

    return (
      <div className="flex flex-col gap-4">
        {/* Top KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-[#121620] border border-slate-800 rounded-xl flex flex-col gap-1 shadow-sm">
            <span className="text-xs text-slate-400">Total Accounts</span>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold text-slate-100 font-mono">{globalStats.total.toLocaleString()}</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">scanned in current batch</span>
          </div>
          <div className="p-5 bg-[#121620] border border-orange-900/40 rounded-xl flex flex-col gap-1 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rounded-bl-full blur-xl"></div>
            <span className="text-xs text-slate-400">Flagged for Review</span>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold text-orange-500 font-mono">{globalStats.flagged.toLocaleString()}</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">top ~{(globalStats.flagged / Math.max(globalStats.total, 1) * 100).toFixed(1)}% by risk score</span>
          </div>
          <div className="p-5 bg-[#121620] border border-red-900/40 rounded-xl flex flex-col gap-1 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full blur-xl"></div>
            <span className="text-xs text-slate-400">Critical Tier</span>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold text-red-500 font-mono">{globalStats.critical.toLocaleString()}</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">{(globalStats.critical / Math.max(globalStats.flagged, 1) * 100).toFixed(1)}% of flagged</span>
          </div>
          <div className="p-5 bg-[#121620] border border-slate-800 rounded-xl flex flex-col gap-1 shadow-sm">
            <span className="text-xs text-slate-400">Avg Model Confidence</span>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold text-cyan-400 font-mono">{(globalStats.avgModelProbability * 100).toFixed(1)}%</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">across all scanned accounts</span>
          </div>
        </div>

        {/* Disclaimer Banner */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
          <span className="text-amber-500 text-sm">⚠</span>
          <p className="text-[10px] text-amber-500/80 leading-relaxed">
            This dataset has no confirmed fraud/mule ground-truth labels. Model was trained on rule-derived proxy labels (occupation/volume mismatch + a bounded extreme-value outlier count, deliberately NOT the anomaly detector's own output, to limit label circularity). Both AUC figures reflect fit to those proxy labels, including the holdout figure measured on a 20% split never touched during fitting -- neither is a validated real-world fraud detection rate.
          </p>
        </div>

        {/* Chart Grids */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[300px]">
          <div className="h-full">
            {renderDoughnut()}
          </div>
          <div className="h-full">
            {renderHorizontalBars("Top Risk Segments", globalStats.segments, "bg-red-500")}
          </div>
          <div className="h-full">
            {renderHorizontalBars("Top Risk Occupations", globalStats.occupations, "bg-red-500")}
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 gap-4">
          <div className="card flex flex-col p-5 border border-slate-800 bg-[#121620]">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-100">Recent Critical Alerts</h3>
              <Link to="/accounts" className="text-[10px] text-green-500 hover:underline">View all</Link>
            </div>
            <div className="flex flex-col gap-3">
              {globalStats.recentCriticals.length === 0 ? (
                <span className="text-slate-500 text-xs">No critical alerts</span>
              ) : (
                globalStats.recentCriticals.map((alert, i) => (
                  <button key={i} onClick={() => handleEvaluate(alert.account_id)} className="flex justify-between items-center group cursor-pointer border-none bg-transparent p-0 m-0 w-full text-left hover:bg-white/5 rounded-lg p-2 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 text-[8px] font-bold uppercase rounded bg-red-500/20 text-red-500 border border-red-500/30">CRITICAL</span>
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-200 font-mono group-hover:text-cyan-400 transition-colors">{alert.account_id}</span>
                        <span className="text-[9px] text-slate-500">Score: {alert.risk_score}</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderEvaluationContent() {
    if (!hasEvaluation) {
      return renderEmptyStateDashboard();
    }

    return (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <RiskScoreWidget
            riskScore={currentAccount!.risk_score}
            riskLevel={currentAccount!.risk_level}
            isSimulated={currentAccount!.is_simulated}
          />
          {renderDoughnut()}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {currentAccount!.human_review?.confidence_band === 'AUTO_BLOCK' ? (
            <button onClick={() => setActionModal({ isOpen: true, decision: 'confirm_mule', reviewerName: '', note: '' })} className="btn-primary flex-1 gap-2" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M10 4v16" />
              </svg>
              <span>Auto-Freeze Account</span>
            </button>
          ) : currentAccount!.human_review?.confidence_band === 'AUTO_CLEAR' ? (
            <button onClick={() => setActionModal({ isOpen: true, decision: 'clear', reviewerName: '', note: '' })} className="btn-secondary flex-1 gap-2" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)', color: '#22c55e' }}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>Auto-Cleared (Safe)</span>
            </button>
          ) : (
            <button onClick={() => setActionModal({ isOpen: true, decision: 'escalate', reviewerName: '', note: '' })} className="btn-secondary flex-1 gap-2" style={{ background: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.3)', color: '#eab308' }}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Human Review Required</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div className="card card-hover bg-[#121620] border-slate-800">
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
          <div className="card card-hover bg-[#121620] border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-500/15">
                <svg className="h-5 w-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <p className="stat-label">Model Engine</p>
                <p className="font-mono font-bold text-heading-sm text-purple-400">
                  {currentAccount!.is_simulated ? 'Simulator' : 'Live ML'}
                </p>
              </div>
            </div>
          </div>
          <div className="card card-hover bg-[#121620] border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/15">
                <svg className="h-5 w-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div>
                <p className="stat-label">Action Priority</p>
                <p className="font-mono font-bold text-heading-sm text-amber-500">
                  {currentAccount!.human_review?.confidence_band === 'AUTO_BLOCK' ? 'Immediate' : 'Review'}
                </p>
              </div>
            </div>
          </div>
          <div className="card card-hover bg-[#121620] border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-500/15">
                <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16" />
                  <polyline points="23 21 16 14 9 21 4 16" />
                </svg>
              </div>
              <div>
                <p className="stat-label">Anomaly Status</p>
                <p className="font-mono font-bold text-heading-sm text-green-500">
                  {currentAccount!.human_review?.anomaly_flagged ? 'Flagged' : 'Normal'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          <Link to="/shap" className="card card-hover flex items-center gap-4 p-5 bg-[#121620] border-slate-800">
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
          <Link to="/network" className="card card-hover flex items-center gap-4 p-5 bg-[#121620] border-slate-800">
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

        <div className="card flex flex-col bg-[#121620] border-slate-800">
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
                  className="w-full p-4 rounded-xl text-left transition-all hover:bg-background-cardHover border border-slate-800"
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
                    <span>{acc.human_review?.confidence_band === 'AUTO_BLOCK' ? 'Auto Block' : 'Review'}</span>
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
      {/* Action Modal */}
      {actionModal?.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#121620] border border-slate-800 rounded-2xl p-6 shadow-2xl w-full max-w-md animate-fade-in relative">
            <h3 className="text-xl font-bold text-slate-100 mb-2">Review Decision</h3>
            <p className="text-sm text-slate-400 mb-6">Please provide your signature and notes for the compliance audit log.</p>
            
            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Reviewer Name</label>
                <input 
                  type="text" 
                  className="w-full bg-[#0b0f19] border border-slate-700 text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-accent" 
                  placeholder="e.g. Jane Doe"
                  value={actionModal.reviewerName}
                  onChange={(e) => setActionModal({...actionModal, reviewerName: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Investigator Notes</label>
                <textarea 
                  className="w-full bg-[#0b0f19] border border-slate-700 text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-accent h-24 resize-none" 
                  placeholder="Add justification or context here..."
                  value={actionModal.note}
                  onChange={(e) => setActionModal({...actionModal, note: e.target.value})}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setActionModal(null)} 
                className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  try {
                    await resolveReview(currentAccount!.account_id, { 
                      decision: actionModal.decision, 
                      reviewer_name: actionModal.reviewerName || 'System (Auto)',
                      note: actionModal.note || 'No notes attached.'
                    })
                    setToastMessage(`Account action logged to Compliance Audit.`)
                  } catch (e) {
                    setToastMessage('Error adding to audit trail.')
                  }
                  setActionModal(null)
                }}
                className="px-6 py-2 bg-accent hover:bg-accent/80 text-navy-950 text-sm font-bold rounded-lg transition-colors"
              >
                Confirm & Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 transform ${toastMessage ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'}`}>
        <div className="bg-[#121620] border border-accent/30 rounded-xl px-5 py-3.5 shadow-2xl shadow-accent/20 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-accent animate-pulse"></div>
          <p className="text-sm font-semibold text-slate-200 tracking-wide">{toastMessage}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 lg:p-8 relative bg-[#0b0f19]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-heading-xl font-bold text-slate-100 tracking-tight">
              Fraud Operations Console
            </h1>
            <p className="mt-1 text-body-md text-slate-400">
              Real-time mule account detection & risk assessment
            </p>
          </div>
          <div className="flex flex-row items-center gap-3 flex-wrap">
            <Link to="/accounts" className="btn-secondary border-slate-700 bg-slate-800 text-slate-200">
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
            placeholder="Search account, alert, case..."
            className="input-field flex-1 bg-[#121620] border-slate-700 text-slate-200 placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={isEvaluating}
            className="btn-primary whitespace-nowrap bg-green-600 hover:bg-green-500 text-white border-green-500"
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