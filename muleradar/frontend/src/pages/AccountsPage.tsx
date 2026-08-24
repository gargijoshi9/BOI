import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell'
import { RiskLevel, fetchAccounts, RiskEvaluationResponse, resolveReview } from '../api/client'
import { useApp } from '../context/AppContext'
import InvestigationReportModal from '../components/InvestigationReportModal'

// Extend the response type locally to accommodate the new backend fields
type ExtendedAccount = RiskEvaluationResponse & {
  account_type?: string;
  occupation?: string;
  age?: number;
  anomaly_score?: number;
  model_probability?: number;
}

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

const getRiskBarColor = (score: number) => {
  if (score >= 900) return 'bg-[#ef4444]';    
  if (score >= 750) return 'bg-[#f97316]';    
  if (score >= 450) return 'bg-[#eab308]';    
  return 'bg-[#22c55e]';                      
};

function AccountsPage() {
  const navigate = useNavigate()
  const { currentAccount, evaluateAccount } = useApp()
  const [filter, setFilter] = useState<RiskFilter>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [hideInSample, setHideInSample] = useState(true)
  const [sortConfig, setSortConfig] = useState<{ key: keyof ExtendedAccount; direction: 'asc' | 'desc' } | null>({ key: 'risk_score', direction: 'desc' })
  const [accounts, setAccounts] = useState<ExtendedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [showDetail, setShowDetail] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  
  const [actionModal, setActionModal] = useState<{ isOpen: boolean; decision: 'confirm_mule' | 'clear' | 'escalate'; reviewerName: string; note: string } | null>(null)

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  useEffect(() => {
    async function loadAccounts() {
      try {
        setLoading(true)
        const data = await fetchAccounts(15000, hideInSample)
        setAccounts(data as ExtendedAccount[])
      } catch (err) {
        setError('Failed to fetch accounts from backend')
      } finally {
        setLoading(false)
      }
    }
    loadAccounts()
  }, [hideInSample])

  const filteredAccounts = useMemo(() => {
    let result = [...accounts]
    if (filter !== 'ALL') {
      result = result.filter((r) => r.risk_level === filter)
    }
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      result = result.filter((r) =>
        r.account_id.toLowerCase().includes(query)
      )
    }
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key]
        const bVal = b[sortConfig.key]
        if (aVal === undefined || bVal === undefined) return 0
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
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
    simulated: accounts.filter((a) => a.is_simulated).length,
  }), [accounts])

  function handleSort(key: keyof ExtendedAccount) {
    setSortConfig((prev) => ({
      key,
      direction: prev?.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }))
  }

  async function handleRowClick(account: ExtendedAccount) {
    try {
      await evaluateAccount(account.account_id)
      navigate('/dashboard')
    } catch (err) {
      console.error('Failed to fetch account details:', err)
    }
  }

  const renderTierBadge = (level: string) => {
    if (level.toUpperCase() === 'CRITICAL') {
      return (
        <span className="border border-rose-500/50 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase" style={{ boxShadow: RISK_GLOWS.Critical }}>
          {level}
        </span>
      );
    }
    if (level.toUpperCase() === 'HIGH') {
      return (
        <span className="border border-orange-500/50 text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
          {level}
        </span>
      );
    }
    if (level.toUpperCase() === 'MEDIUM') {
      return (
        <span className="border border-amber-500/50 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
          {level}
        </span>
      );
    }
    return (
      <span className="border border-slate-600 text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
        {level}
      </span>
    );
  };

  const renderStatus = (acc: ExtendedAccount) => {
    if (!acc.human_review) return <span className="text-slate-500">Unknown</span>;
    if (acc.human_review.requires_review) return <span className="text-slate-400">Under Review</span>;
    if (acc.human_review.confidence_band === 'AUTO_BLOCK') return <span className="text-rose-400">Blocked</span>;
    return <span className="text-emerald-400">Cleared</span>;
  };

  // =======================================================================
  // FULL PAGE DETAIL VIEW
  // =======================================================================
  if (showDetail && currentAccount) {
    
    // --- SHAP NORMALIZATION LOGIC ---
    let displayShap = [...(currentAccount.shap_explanation || [])];
    const sumShap = displayShap.reduce((acc, f) => acc + f.contribution, 0);

    // If an account is High Risk but XGBoost output negative SHAP (base margin artifact), visually invert it
    if (currentAccount.risk_score >= 500 && sumShap < 0) {
      displayShap = displayShap.map(f => ({ ...f, contribution: -f.contribution }));
    } else if (currentAccount.risk_score < 500 && sumShap > 0) {
      displayShap = displayShap.map(f => ({ ...f, contribution: -f.contribution }));
    }

    // Now extract the top drivers accurately
    const topPositiveFeatures = displayShap
      .filter((f) => f.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3)
      .map((f) => f.feature);

    const shapSummary = topPositiveFeatures.length > 0
      ? `Flagged primarily due to ${topPositiveFeatures.join(', ')}, against an occupation profile of '${currentAccount.occupation || 'Unknown'}' and account type '${currentAccount.account_type || 'Unknown'}'.`
      : `Risk assessment derived from standard transaction velocity and structural patterns.`;

    const summaryBarColor = topPositiveFeatures.length > 0 ? 'bg-rose-500' : 'bg-emerald-500';
    const maxAbs = Math.max(...(displayShap.map(f => Math.abs(f.contribution)) || [1]));

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
                    className="w-full bg-[#0b0f19] border border-slate-700 text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-cyan-500" 
                    placeholder="e.g. Jane Doe"
                    value={actionModal.reviewerName}
                    onChange={(e) => setActionModal({...actionModal, reviewerName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Investigator Notes</label>
                  <textarea 
                    className="w-full bg-[#0b0f19] border border-slate-700 text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-cyan-500 h-24 resize-none" 
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
                  className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 text-sm font-bold rounded-lg transition-colors"
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
        <div className="flex flex-1 flex-col overflow-y-auto bg-[#0b0e14] p-8 animate-fade-in relative">
          
          <div className="flex items-center text-sm text-slate-400 mb-6">
            <button 
              onClick={() => setShowDetail(false)} 
              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              <span className="text-lg leading-none">&lsaquo;</span> Accounts
            </button>
            <span className="mx-2 text-slate-600">&rsaquo;</span>
            <span className="text-slate-200">{currentAccount.account_id}</span>
          </div>

          {detailLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm" style={{ color: '#22d3ee' }}>Loading full analysis...</p>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto w-full">
              
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
                <div className="flex flex-col md:flex-row gap-6 md:gap-12 md:items-center">
                  <div>
                    <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">{currentAccount.account_id}</h1>
                    <div className="flex gap-2">
                      {renderTierBadge(currentAccount.risk_level)}
                      <span className="border border-slate-600 text-slate-300 bg-slate-800/50 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
                        {currentAccount.human_review?.confidence_band === 'AUTO_BLOCK' ? 'Auto-Blocked' : 'Under Review'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="hidden md:block h-16 w-px bg-slate-800"></div>
                  
                  <div>
                    <div className="text-4xl font-extrabold text-white tracking-tight">
                      {currentAccount.risk_score} <span className="text-xl text-slate-500 font-medium">/ 1000</span>
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">MuleRadar Score</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsReportOpen(true)}
                    className="px-5 py-2.5 text-xs font-medium uppercase tracking-wider border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500/10 transition-colors"
                  >
                    Generate Report
                  </button>
                  <button onClick={() => setActionModal({ isOpen: true, decision: 'clear', reviewerName: '', note: '' })} className="px-5 py-2.5 text-xs font-medium uppercase tracking-wider border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors">
                    Dismiss
                  </button>
                  <button onClick={() => setActionModal({ isOpen: true, decision: 'escalate', reviewerName: '', note: '' })} className="px-5 py-2.5 text-xs font-medium uppercase tracking-wider border border-orange-500/30 text-orange-400 rounded-lg hover:bg-orange-500/10 transition-colors">
                    Escalate
                  </button>
                  <button onClick={() => setActionModal({ isOpen: true, decision: 'confirm_mule', reviewerName: '', note: '' })} className="px-5 py-2.5 text-xs font-medium uppercase tracking-wider border border-rose-500/30 text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors">
                    Freeze Account
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 py-6 border-y border-slate-800/60 mb-8">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Account Type</div>
                  <div className="text-sm text-slate-200 font-medium">{currentAccount.account_type || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Occupation</div>
                  <div className="text-sm text-slate-200 font-medium capitalize">{currentAccount.occupation || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Age</div>
                  <div className="text-sm text-slate-200 font-medium">{currentAccount.age || 0}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Network Nodes</div>
                  <div className="text-sm text-slate-200 font-medium">{currentAccount.network_connections?.nodes.length || 0}</div>
                </div>
              </div>

              {/* Removed dead buttons as requested */}
              <div className="flex gap-8 border-b border-slate-800/60 mb-8 px-2 overflow-x-auto">
                <button className="pb-3 border-b-2 border-emerald-500 text-emerald-400 font-medium text-sm whitespace-nowrap">Overview</button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
                
                <div className="lg:col-span-4 bg-[#141820] border border-slate-800/60 rounded-xl p-6 flex flex-col h-min">
                  <h3 className="text-sm font-bold text-slate-200 mb-6">Risk Summary</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-800/60">
                      <span className="text-xs text-slate-400">MuleRadar Risk Score</span>
                      <span className="text-sm font-bold text-white">{currentAccount.risk_score} <span className="text-slate-500 font-normal">/ 1000</span></span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-slate-800/60">
                      <span className="text-xs text-slate-400">Risk Tier</span>
                      <span className="text-sm font-bold" style={{ color: RISK_COLORS[currentAccount.risk_level as RiskLevel] }}>{currentAccount.risk_level}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-slate-800/60">
                      <span className="text-xs text-slate-400">Model Score (XGBoost Ensemble)</span>
                      <span className="text-sm font-bold text-slate-200">{currentAccount.model_probability?.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-slate-800/60">
                      <span className="text-xs text-slate-400">Anomaly Score (Isolation Forest)</span>
                      <span className="text-sm font-bold text-slate-200">{currentAccount.anomaly_score?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-start pt-2">
                      <span className="text-xs text-slate-400 w-1/3">Recommended Action</span>
                      <span className="text-[11px] font-mono leading-relaxed text-emerald-400 text-right w-2/3 break-words">
                        {currentAccount.human_review?.confidence_band === 'AUTO_BLOCK' ? 'Potential account freeze + SAR draft + investigator review' :
                         currentAccount.human_review?.confidence_band === 'HUMAN_REVIEW' ? 'Investigator review required + Enhanced Due Diligence' :
                         'No immediate action required'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-8 bg-[#141820] border border-slate-800/60 rounded-xl p-6 flex flex-col h-min">
                  <h3 className="text-sm font-bold text-slate-200 mb-4">Top Risk Factors (SHAP)</h3>
                  
                  <div className="flex items-start gap-3 mb-8">
                    <div className={`w-1 h-10 ${summaryBarColor} rounded-full mt-1`}></div>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                      {shapSummary}
                    </p>
                  </div>

                  <div className="flex flex-col gap-4">
                    {displayShap
                      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
                      .slice(0, 8)
                      .map((f) => {
                        const isPos = f.contribution > 0;
                        const width = Math.min(100, (Math.abs(f.contribution) / maxAbs) * 100);
                        
                        return (
                          <div key={f.feature} className="grid grid-cols-[140px_1fr_60px] md:grid-cols-[180px_1fr_60px] gap-4 items-center">
                            <div className="text-xs text-slate-300 font-mono truncate" title={f.feature}>
                              {f.feature}
                            </div>
                            
                            <div className="flex w-full h-3 bg-transparent">
                              {/* Negative side */}
                              <div className="w-1/2 flex justify-end border-r border-slate-700/50 pr-[2px]">
                                {!isPos && (
                                  <div 
                                    className="h-full bg-emerald-500/80 rounded-sm" 
                                    style={{ width: `${width}%` }} 
                                  />
                                )}
                              </div>
                              {/* Positive side */}
                              <div className="w-1/2 flex justify-start pl-[2px]">
                                {isPos && (
                                  <div 
                                    className="h-full bg-rose-500/80 rounded-sm" 
                                    style={{ width: `${width}%` }} 
                                  />
                                )}
                              </div>
                            </div>

                            <div className={`text-xs font-mono text-right ${isPos ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {isPos ? '+' : ''}{f.contribution.toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

              </div>
            </div>
          )}
          {currentAccount && (
            <InvestigationReportModal
              account={currentAccount}
              isOpen={isReportOpen}
              onClose={() => setIsReportOpen(false)}
            />
          )}
        </div>
      </PageShell>
    )
  }

  // =======================================================================
  // STANDARD DIRECTORY VIEW
  // =======================================================================
  return (
    <PageShell>
      <div className="flex flex-1 flex-col gap-6 overflow-hidden p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: '#f8fafc' }}>
              Accounts Directory
            </h1>
            <p className="mt-1 text-sm" style={{ color: '#94a3b8' }}>
              {filteredAccounts.length} of {accounts.length} accounts • {stats.simulated} simulated
            </p>
          </div>
          <div className="flex flex-row items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer bg-white/5 border border-white/10 px-3 py-2 rounded-lg hover:bg-white/10 transition shadow-sm">
              <input
                type="checkbox"
                checked={hideInSample}
                onChange={(e) => setHideInSample(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/50"
              />
              Hide Training Data
            </label>
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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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

        <div className="flex flex-row gap-2 overflow-x-auto pb-2">
          {FILTERS.map((f) => {
            const isActive = f === filter
            const count = f === 'ALL' ? stats.total : stats[f.toLowerCase() as keyof typeof stats]
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`flex flex-row items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-wider whitespace-nowrap rounded-full transition-all ${isActive
                    ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 text-cyan-400'
                    : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                  }`}
              >
                {f}
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${isActive
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

        <div className="flex-1 overflow-hidden flex flex-col">
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
            <div className="overflow-auto bg-[#141820] border border-slate-800/80 rounded-xl flex-1">
              <table className="w-full text-left text-sm whitespace-nowrap relative">
                <thead className="bg-[#1C212B] text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort('account_id')}>
                      ACCOUNT ID {sortConfig?.key === 'account_id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-4">TYPE</th>
                    <th className="px-6 py-4">OCCUPATION</th>
                    <th className="px-6 py-4">AGE</th>
                    <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort('anomaly_score')}>
                      ANOMALY {sortConfig?.key === 'anomaly_score' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort('model_probability')}>
                      ENSEMBLE PROB. {sortConfig?.key === 'model_probability' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-4 cursor-pointer text-emerald-400" onClick={() => handleSort('risk_score')}>
                      RISK SCORE {sortConfig?.key === 'risk_score' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↓'}
                    </th>
                    <th className="px-6 py-4">TIER</th>
                    <th className="px-6 py-4">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredAccounts.map((account) => (
                    <tr
                      key={account.account_id}
                      onClick={() => handleRowClick(account)}
                      className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-3.5 font-mono text-slate-200 flex items-center gap-2">
                        {account.account_id}
                        {account.was_seen_during_training && (
                          <span
                            className="bg-slate-700 text-slate-300 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider"
                            title="In-Sample Training Data"
                          >
                            Train
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-slate-300">{account.account_type || 'Unknown'}</td>
                      <td className="px-6 py-3.5 text-slate-300 capitalize">{account.occupation || 'Unknown'}</td>
                      <td className="px-6 py-3.5 text-slate-300">{account.age || 0}</td>
                      <td className="px-6 py-3.5 text-slate-300">
                        {(account.anomaly_score || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-3.5 text-slate-300">
                        {(account.model_probability || 0).toFixed(3)}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="w-8 font-medium text-slate-200">{account.risk_score}</span>
                          <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getRiskBarColor(account.risk_score)} transition-all`}
                              style={{ width: `${(account.risk_score / 1000) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        {renderTierBadge(account.risk_level)}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-400">
                        {renderStatus(account)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}

export default AccountsPage