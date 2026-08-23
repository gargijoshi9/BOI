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
  const { currentAccount, evaluateAccount, isEvaluating, evaluationError } = useApp()
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
    if (!accountInput.trim()) return
    handleEvaluate(accountInput.trim())
  }

  const renderDoughnut = () => {
    if (!globalStats || globalStats.total === 0) return (
      <div className="rounded-2xl border border-border/50 bg-background-card/80 backdrop-blur-xl flex items-center justify-center p-6 h-full shadow-xl min-h-[260px]">
        <span className="text-foreground-muted text-xs">Loading risk breakdown...</span>
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
      <div className="rounded-2xl border border-border/50 bg-background-card/80 backdrop-blur-xl flex flex-col p-6 h-full shadow-xl">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-6">Risk Score Distribution</h3>
        <div className="flex flex-row items-center justify-between flex-1">
          <div className="relative w-32 h-32 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="#22c55e" strokeWidth="12" strokeDasharray={`${(pct1/100)*c} ${c}`} strokeDashoffset={0} />
              <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="#eab308" strokeWidth="12" strokeDasharray={`${(pct2/100)*c} ${c}`} strokeDashoffset={-offset2} />
              <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="#f97316" strokeWidth="12" strokeDasharray={`${(pct3/100)*c} ${c}`} strokeDashoffset={-offset3} />
              <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="#ef4444" strokeWidth="12" strokeDasharray={`${(pct4/100)*c} ${c}`} strokeDashoffset={-offset4} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-red-400 font-mono">{criticalPct.toFixed(1)}%</span>
              <span className="text-[9px] text-foreground-muted uppercase">Critical</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 flex-1 ml-4 justify-center">
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-xs text-foreground-muted">Critical</span></div><span className="font-mono text-foreground font-semibold text-xs">{critical.toLocaleString()}</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500"></div><span className="text-xs text-foreground-muted">High</span></div><span className="font-mono text-foreground font-semibold text-xs">{high.toLocaleString()}</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500"></div><span className="text-xs text-foreground-muted">Medium</span></div><span className="font-mono text-foreground font-semibold text-xs">{medium.toLocaleString()}</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="text-xs text-foreground-muted">Low</span></div><span className="font-mono text-foreground font-semibold text-xs">{low.toLocaleString()}</span></div>
          </div>
        </div>
      </div>
    )
  }

  const renderHorizontalBars = (title: string, data: Record<string, number>, colorClass: string) => {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxVal = entries[0]?.[1] || 1;

    return (
      <div className="rounded-2xl border border-border/50 bg-background-card/80 backdrop-blur-xl flex flex-col p-6 h-full shadow-xl">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-6">{title}</h3>
        <div className="flex flex-col gap-4 flex-1 justify-center">
          {entries.length === 0 ? (
            <span className="text-foreground-muted text-xs">No high risk data</span>
          ) : (
            entries.map(([label, count]) => (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground-muted capitalize truncate pr-4">{label}</span>
                  <span className="font-mono font-semibold text-foreground">{count}</span>
                </div>
                <div className="w-full bg-background/60 h-1.5 rounded-full overflow-hidden border border-border/30">
                  <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${(count / maxVal) * 100}%` }}></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <PageShell>
      {/* Action Modal */}
      {actionModal?.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-background-card border border-border/60 rounded-2xl p-6 shadow-2xl w-full max-w-md animate-fade-in relative space-y-4">
            <div>
              <h3 className="text-xl font-bold text-foreground">Review Decision</h3>
              <p className="text-xs text-foreground-muted mt-1">Please provide your signature and notes for the compliance audit log.</p>
            </div>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1 block">Reviewer Name</label>
                <input 
                  type="text" 
                  className="w-full bg-background/50 border border-border/60 text-foreground px-3.5 py-2 rounded-xl text-xs focus:outline-none focus:border-accent" 
                  placeholder="e.g. Senior AML Officer"
                  value={actionModal.reviewerName}
                  onChange={(e) => setActionModal({...actionModal, reviewerName: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1 block">Investigator Notes</label>
                <textarea 
                  className="w-full bg-background/50 border border-border/60 text-foreground px-3.5 py-2 rounded-xl text-xs focus:outline-none focus:border-accent h-24 resize-none" 
                  placeholder="Add justification or context here..."
                  value={actionModal.note}
                  onChange={(e) => setActionModal({...actionModal, note: e.target.value})}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setActionModal(null)} 
                className="px-4 py-2 text-xs font-semibold text-foreground-muted hover:text-foreground transition-colors"
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
                className="px-6 py-2 bg-accent hover:bg-accent-hover text-navy-950 text-xs font-bold rounded-xl transition-all shadow-glow-teal"
              >
                Confirm & Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 transform ${toastMessage ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'}`}>
        <div className="bg-background-card border border-accent/30 rounded-xl px-5 py-3.5 shadow-2xl shadow-accent/20 flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-accent animate-pulse"></div>
          <p className="text-xs font-semibold text-foreground tracking-wide">{toastMessage}</p>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-accent/10 border border-accent/20 text-accent text-xs font-semibold tracking-wide uppercase">
                AI/ML Mule Account Intelligence
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mt-2 tracking-tight">
              Fraud Operations Console
            </h1>
            <p className="text-body-sm text-foreground-muted mt-1">
              Real-time mule account detection, behavioral profiling & risk assessment
            </p>
          </div>

          <div className="flex flex-row items-center gap-3 flex-wrap">
            <Link to="/accounts" className="px-4 py-2.5 rounded-xl border border-border/60 bg-background-card/80 text-foreground hover:bg-background-cardHover text-xs font-semibold transition">
              Browse Accounts
            </Link>
            {currentAccount && (
              <button
                type="button"
                onClick={() => openDrawerForAccount(currentAccount.account_id)}
                className="px-5 py-2.5 rounded-xl bg-accent text-navy-950 hover:bg-accent-hover font-semibold text-xs transition-all shadow-glow-teal flex items-center gap-2"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                AI Summary
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch gap-3 max-w-3xl">
          <input
            type="text"
            value={accountInput}
            onChange={(e) => setAccountInput(e.target.value)}
            placeholder="Search account ID, alert, or case..."
            className="input-field flex-1 bg-background/50 border border-border/60 text-xs text-foreground placeholder-foreground-muted focus:outline-none focus:border-accent rounded-xl"
          />
          <button
            type="submit"
            disabled={isEvaluating}
            className="px-6 py-2.5 rounded-xl bg-accent text-navy-950 hover:bg-accent-hover font-semibold text-xs transition-all shadow-glow-teal whitespace-nowrap"
          >
            {isEvaluating ? 'Evaluating...' : 'Evaluate Account'}
          </button>
        </form>

        {isEvaluating && (
          <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 text-accent text-xs flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Analyzing account behavioral features...</span>
          </div>
        )}

        {evaluationError && !isEvaluating && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Error: {evaluationError}</span>
          </div>
        )}

        {/* ACTIVE EVALUATED ACCOUNT PANEL (Shown at top when an account is actively selected/evaluated) */}
        {currentAccount && (
          <div className="rounded-2xl border border-accent/30 bg-background-card/90 backdrop-blur-xl p-6 shadow-2xl space-y-5 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
              <div>
                <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Active Evaluation Focus</span>
                <h2 className="text-xl font-bold font-mono text-foreground mt-0.5">{currentAccount.account_id}</h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link to="/shap" className="px-3.5 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-semibold hover:bg-cyan-500/20 transition flex items-center gap-1.5">
                  <span>📊</span> SHAP Analysis
                </Link>
                <Link to="/network" className="px-3.5 py-1.5 rounded-xl border border-accent/30 bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition flex items-center gap-1.5">
                  <span>🔗</span> Network Ring
                </Link>
                <button
                  onClick={() => openDrawerForAccount(currentAccount.account_id)}
                  className="px-3.5 py-1.5 rounded-xl bg-accent text-navy-950 text-xs font-bold hover:bg-accent-hover transition flex items-center gap-1.5"
                >
                  <span>🤖</span> Ask AI Assistant
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <RiskScoreWidget
                riskScore={currentAccount.risk_score}
                riskLevel={currentAccount.risk_level}
                isSimulated={currentAccount.is_simulated}
              />
              <div className="rounded-2xl border border-border/50 bg-background/40 p-5 flex flex-col justify-between space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-background-card border border-border/40">
                    <span className="stat-label">Kill Chain Stage</span>
                    <p className="mt-1 font-bold text-sm text-amber-400">{(currentAccount as any).kill_chain_stage || 'None'}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-background-card border border-border/40">
                    <span className="stat-label">Network Counterparties</span>
                    <p className="mt-1 font-mono font-bold text-sm text-accent">
                      {currentAccount.network_connections?.nodes.length ?? 0} Nodes
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="stat-label">Adjudication Action</span>
                  <div className="mt-2">
                    {currentAccount.human_review?.confidence_band === 'AUTO_BLOCK' ? (
                      <button onClick={() => setActionModal({ isOpen: true, decision: 'confirm_mule', reviewerName: '', note: '' })} className="btn-primary w-full gap-2 rounded-xl justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
                        <span>Auto-Freeze Account</span>
                      </button>
                    ) : currentAccount.human_review?.confidence_band === 'AUTO_CLEAR' ? (
                      <button onClick={() => setActionModal({ isOpen: true, decision: 'clear', reviewerName: '', note: '' })} className="btn-secondary w-full gap-2 rounded-xl justify-center" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)', color: '#22c55e' }}>
                        <span>Auto-Cleared (Safe)</span>
                      </button>
                    ) : (
                      <button onClick={() => setActionModal({ isOpen: true, decision: 'escalate', reviewerName: '', note: '' })} className="btn-secondary w-full gap-2 rounded-xl justify-center" style={{ background: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.3)', color: '#eab308' }}>
                        <span>Human Review Required</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SYSTEM-WIDE EXECUTIVE ANALYTICS SECTION (Always present on Dashboard) */}
        {globalStats ? (
          <div className="flex flex-col gap-5">
            {/* Top KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-background-card/80 border border-border/50 shadow-xl flex flex-col gap-1">
                <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Total Scanned Accounts</span>
                <div className="flex items-end justify-between mt-1">
                  <span className="text-3xl font-bold text-foreground font-mono">{globalStats.total.toLocaleString()}</span>
                </div>
                <span className="text-[11px] text-foreground-muted">Evaluated in current batch</span>
              </div>
              
              <div className="p-5 rounded-2xl bg-background-card/80 border border-orange-500/30 shadow-xl flex flex-col gap-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rounded-bl-full blur-xl pointer-events-none"></div>
                <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Flagged for Review</span>
                <div className="flex items-end justify-between mt-1">
                  <span className="text-3xl font-bold text-orange-400 font-mono">{globalStats.flagged.toLocaleString()}</span>
                </div>
                <span className="text-[11px] text-orange-400/80">Top ~{(globalStats.flagged / Math.max(globalStats.total, 1) * 100).toFixed(1)}% by risk score</span>
              </div>

              <div className="p-5 rounded-2xl bg-background-card/80 border border-red-500/30 shadow-xl flex flex-col gap-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full blur-xl pointer-events-none"></div>
                <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Critical Risk Tier</span>
                <div className="flex items-end justify-between mt-1">
                  <span className="text-3xl font-bold text-red-400 font-mono">{globalStats.critical.toLocaleString()}</span>
                </div>
                <span className="text-[11px] text-red-400/80">{(globalStats.critical / Math.max(globalStats.flagged, 1) * 100).toFixed(1)}% of flagged pool</span>
              </div>

              <div className="p-5 rounded-2xl bg-background-card/80 border border-border/50 shadow-xl flex flex-col gap-1">
                <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Avg Model Confidence</span>
                <div className="flex items-end justify-between mt-1">
                  <span className="text-3xl font-bold text-cyan-400 font-mono">{(globalStats.avgModelProbability * 100).toFixed(1)}%</span>
                </div>
                <span className="text-[11px] text-foreground-muted">Across all evaluated accounts</span>
              </div>
            </div>

            {/* Methodology Disclaimer Banner */}
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-body-sm text-amber-300/90 leading-relaxed">
                Data Methodology Note: Model evaluated using hold-out validation split. Post-event proxy features and timestamp flags were explicitly purged to prevent data leakage and ensure real-world applicability.
              </p>
            </div>

            {/* System Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="min-h-[280px]">
                {renderDoughnut()}
              </div>
              <div className="min-h-[280px]">
                {renderHorizontalBars("Top Risk Segments", globalStats.segments, "bg-red-500")}
              </div>
              <div className="min-h-[280px]">
                {renderHorizontalBars("Top Risk Occupations", globalStats.occupations, "bg-red-500")}
              </div>
            </div>

            {/* Bottom Alerts Row */}
            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-2xl border border-border/50 bg-background-card/80 backdrop-blur-xl flex flex-col p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4 border-b border-border/50 pb-3">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Recent Critical Alerts</h3>
                  <Link to="/accounts" className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors">View All Accounts →</Link>
                </div>
                <div className="flex flex-col gap-2">
                  {globalStats.recentCriticals.length === 0 ? (
                    <span className="text-foreground-muted text-xs p-4 text-center">No critical alerts detected.</span>
                  ) : (
                    globalStats.recentCriticals.map((alert, i) => (
                      <button key={i} onClick={() => handleEvaluate(alert.account_id)} className="flex justify-between items-center group cursor-pointer border border-border/30 bg-background/30 p-3 rounded-xl hover:bg-accent/5 hover:border-accent/30 transition-all text-left">
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-md bg-red-500/10 text-red-400 border border-red-500/30">CRITICAL</span>
                          <div className="flex flex-col">
                            <span className="text-xs text-foreground font-mono font-semibold group-hover:text-accent transition-colors">{alert.account_id}</span>
                            <span className="text-[10px] text-foreground-muted">Risk Score: {alert.risk_score}/1000</span>
                          </div>
                        </div>
                        <span className="text-xs text-accent font-medium">Inspect →</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center p-20">
            <span className="text-foreground-muted text-sm">Loading Executive Dashboard Data...</span>
          </div>
        )}
      </main>
    </PageShell>
  )
}

export default Dashboard