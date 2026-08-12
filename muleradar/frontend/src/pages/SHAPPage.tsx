import { useState } from 'react'
import PageShell from '../components/PageShell'
import ShapWidget from '../components/ShapWidget'
import { useApp } from '../context/AppContext'
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
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: '#f8fafc' }}>
            SHAP Explainability
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#94a3b8' }}>
            Feature importance breakdown for the evaluated account
          </p>
        </div>

        {/* Account Selection + Manual Input */}
        <div className="flex flex-row gap-5">
          <div className="glass flex flex-1 flex-col p-5 min-w-[320px] max-w-[380px]">
            <h3 className="text-xs font-medium uppercase mb-4" style={{ color: '#cbd5e1', letterSpacing: '0.18em' }}>
              Select Account
            </h3>
            
            {/* Manual Account ID Input */}
            <form onSubmit={handleManualEvaluate} className="flex flex-row gap-2 mb-4">
              <input
                type="text"
                value={manualAccountId}
                onChange={(e) => setManualAccountId(e.target.value)}
                placeholder="Or enter Account ID..."
                className="flex-1 px-3 py-2 text-sm focus:outline-none"
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#f8fafc',
                  borderRadius: '6px',
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
                className="px-4 py-2 text-sm font-medium uppercase tracking-wider rounded transition-all whitespace-nowrap"
                style={{
                  background: isEvaluating ? 'rgba(34, 211, 238, 0.05)' : 'rgba(34, 211, 238, 0.1)',
                  border: isEvaluating ? '1px solid rgba(34, 211, 238, 0.2)' : '1px solid rgba(34, 211, 238, 0.4)',
                  color: isEvaluating ? '#22d3ee80' : '#22d3ee',
                  cursor: isEvaluating ? 'not-allowed' : 'pointer',
                }}
              >
                {isEvaluating ? 'Loading...' : 'Evaluate'}
              </button>
            </form>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {recentEvaluations.map((acc) => (
                <button
                  key={acc.account_id}
                  onClick={() => handleAccountSelect(acc.account_id)}
                  className={`w-full text-left p-3 rounded transition-all ${
                    currentAccount?.account_id === acc.account_id
                      ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30'
                      : 'border border-transparent hover:border-white/10 hover:bg-white/5'
                  }`}
                  style={{
                    background: currentAccount?.account_id === acc.account_id
                      ? 'rgba(34, 211, 238, 0.08)'
                      : 'transparent',
                  }}
                  disabled={isEvaluating}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm" style={{ color: '#f8fafc' }}>
                      {acc.account_id}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${
                        acc.is_simulated ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                      }`}
                    >
                      {acc.is_simulated ? 'Simulated' : 'Live'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1" style={{ color: '#cbd5e1' }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
                      Risk: {acc.risk_score}/1000
                    </span>
                    <span style={{ color: '#94a3b8' }}>{acc.kill_chain_stage}</span>
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

          <div className="flex flex-1 flex-col min-w-0">
            {currentAccount ? (
              <>
                <ShapWidget shapExplanation={shapFeatures} />

                <div className="glass flex flex-col p-5 mt-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-medium uppercase" style={{ color: '#cbd5e1', letterSpacing: '0.18em' }}>
                      Account Context
                    </h3>
                    <button
                      onClick={() => setIsReportOpen(true)}
                      className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-lg hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(168, 85, 247, 0.2))',
                        border: '1px solid rgba(34, 211, 238, 0.5)',
                        color: '#22d3ee',
                        boxShadow: '0 0 15px rgba(34, 211, 238, 0.15)',
                      }}
                    >
                      <span>📄</span> Generate Investigation Report
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="block text-xs" style={{ color: '#94a3b8' }}>Risk Score</span>
                      <span className="font-bold text-lg text-gradient-cyan-purple">{currentAccount.risk_score}</span>
                    </div>
                    <div>
                      <span className="block text-xs" style={{ color: '#94a3b8' }}>Risk Level</span>
                      <span className="font-bold text-lg" style={{ color: '#ef4444' }}>{currentAccount.risk_level}</span>
                    </div>
                    <div>
                      <span className="block text-xs" style={{ color: '#94a3b8' }}>Kill Chain Stage</span>
                      <span className="font-bold text-lg" style={{ color: '#f97316' }}>{currentAccount.kill_chain_stage}</span>
                    </div>
                    <div>
                      <span className="block text-xs" style={{ color: '#94a3b8' }}>Mode</span>
                      <span className="font-bold text-lg" style={{ color: currentAccount.is_simulated ? '#ef4444' : '#22c55e' }}>
                        {currentAccount.is_simulated ? 'Simulated' : 'Live Model'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* PDF Investigation Report Modal */}
                <InvestigationReportModal
                  account={currentAccount}
                  isOpen={isReportOpen}
                  onClose={() => setIsReportOpen(false)}
                />
              </>
            ) : (
              <>
                {/* Empty State - No account selected */}
                <div className="glass flex flex-1 flex-col items-center justify-center p-12 text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(34, 211, 238, 0.1)', border: '1px solid rgba(34, 211, 238, 0.3)' }}>
                    <span className="text-2xl">📊</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: '#f8fafc' }}>Select an Account</h3>
                  <p className="text-sm" style={{ color: '#94a3b8' }}>
                    Choose an account from the list or enter an Account ID manually to view SHAP feature importance.
                  </p>
                </div>
              </>
            )}

            {isEvaluating && (
              <div className="glass flex items-center justify-center p-8 mt-5">
                <p className="text-sm" style={{ color: '#22d3ee' }}>
                  Loading SHAP explanation
                  <span className="ellipsis-dot ml-1">.</span>
                  <span className="ellipsis-dot">.</span>
                  <span className="ellipsis-dot">.</span>
                </p>
              </div>
            )}

            {evaluationError && (
              <div className="glass flex items-center justify-center p-4 mt-5 border border-red-500/30 bg-red-500/5">
                <p className="text-sm" style={{ color: '#ef4444' }}>{evaluationError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}

export default SHAPPage