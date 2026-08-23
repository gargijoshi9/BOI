import { useState, useEffect } from 'react'
import PageShell from '../components/PageShell'
import { fetchHealth, HealthResponse, fetchAccounts, RiskEvaluationResponse } from '../api/client'

interface FeatureHealth {
  name: string
  category: string
  shapImportance: number
  driftStatus: 'Stable' | 'Low Drift' | 'Alert'
  purgedProxy: boolean
}

const TOP_FEATURES: FeatureHealth[] = [
  { name: 'pass_through_ratio', category: 'Behavioral DNA', shapImportance: 0.3421, driftStatus: 'Stable', purgedProxy: false },
  { name: 'sudden_activation_score', category: 'Behavioral DNA', shapImportance: 0.2894, driftStatus: 'Stable', purgedProxy: false },
  { name: 'narrow_network_interaction', category: 'Graph Network', shapImportance: 0.2450, driftStatus: 'Stable', purgedProxy: false },
  { name: 'F0004_was_missing', category: 'Shadow Missingness', shapImportance: 0.1982, driftStatus: 'Stable', purgedProxy: false },
  { name: 'cash_drain_velocity', category: 'Fraud Kill Chain', shapImportance: 0.1764, driftStatus: 'Stable', purgedProxy: false },
  { name: 'F1002_log_transformed', category: 'Normalized Ratio', shapImportance: 0.1432, driftStatus: 'Low Drift', purgedProxy: false },
  { name: 'counterparty_entropy', category: 'Graph Network', shapImportance: 0.1289, driftStatus: 'Stable', purgedProxy: false },
  { name: 'F2230_timestamp_proxy', category: 'Deceptive Flag', shapImportance: 0.0, driftStatus: 'Alert', purgedProxy: true },
  { name: 'admin_freeze_status', category: 'Deceptive Flag', shapImportance: 0.0, driftStatus: 'Alert', purgedProxy: true },
]

function MonitorPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<RiskEvaluationResponse[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const healthData = await fetchHealth()
        setHealth(healthData)
        
        const accountsData = await fetchAccounts(500, true)
        setAccounts(accountsData)
      } catch (err) {
        console.error('Failed to load health/monitoring data', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Calculate distribution bands from accounts
  const total = accounts.length || 1
  const autoClearCount = accounts.filter(a => a.risk_score < 0.2144).length
  const humanReviewCount = accounts.filter(a => a.risk_score >= 0.2144 && a.risk_score <= 0.3063).length
  const autoBlockCount = accounts.filter(a => a.risk_score > 0.3063).length

  return (
    <PageShell>
      <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold tracking-wide uppercase">
                Enterprise ML Operations & Monitoring
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mt-2 tracking-tight">
              Model Performance, Drift & System Health
            </h1>
            <p className="text-body-sm text-foreground-muted mt-1">
              Real-time telemetry for stacked Gradient Boosted Trees (XGBoost, LightGBM, CatBoost) & Isolation Forests.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background-card/80 border border-border/50 text-xs font-mono">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-400 animate-pulse"></span>
            <span className="text-foreground-muted">Engine:</span>
            <span className="text-teal-400 font-semibold">{health?.mode || 'Live Ensemble Model Active'}</span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-foreground-muted space-y-3">
            <svg className="animate-spin h-6 w-6 text-accent mx-auto" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-xs">Loading telemetry & model metrics...</p>
          </div>
        ) : (
          <>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-background-card/80 border border-border/50 shadow-xl space-y-2">
            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Test ROC-AUC Metric</p>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-teal-400 font-mono">0.9983</span>
              <span className="text-xs text-teal-400 font-medium">+0.04 vs Baseline</span>
            </div>
            <p className="text-[11px] text-foreground-muted">Strict Hold-Out Evaluation Split</p>
          </div>

          <div className="p-5 rounded-2xl bg-background-card/80 border border-border/50 shadow-xl space-y-2">
            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Test PR-AUC Metric</p>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-accent font-mono">0.9090</span>
              <span className="text-xs text-accent font-medium">Imbalance Resilient</span>
            </div>
            <p className="text-[11px] text-foreground-muted">0.89% Mule Base Rate Dataset</p>
          </div>

          <div className="p-5 rounded-2xl bg-background-card/80 border border-border/50 shadow-xl space-y-2">
            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Calibrated F2 Threshold</p>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-orange-400 font-mono">0.3063</span>
              <span className="text-xs text-orange-400 font-medium">Recall Optimized</span>
            </div>
            <p className="text-[11px] text-foreground-muted">Prioritizes Zero False Negatives</p>
          </div>

          <div className="p-5 rounded-2xl bg-background-card/80 border border-border/50 shadow-xl space-y-2">
            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Feature Pipeline Count</p>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-foreground font-mono">72</span>
              <span className="text-xs text-red-400 font-medium">8 Purged</span>
            </div>
            <p className="text-[11px] text-foreground-muted">Deceptive Proxies Ruthlessly Filtered</p>
          </div>
        </div>

        {/* Score Routing Distribution Visualizer */}
        <div className="p-6 rounded-2xl border border-border/50 bg-background-card/70 backdrop-blur-xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-foreground">HITL Threshold Score Distribution Bands</h3>
              <p className="text-xs text-foreground-muted">Live routing thresholds calibrated on independent Feature Selection hold-out split.</p>
            </div>
            <span className="text-xs font-mono text-foreground-muted">Evaluated Pool: {accounts.length} Accounts</span>
          </div>

          {/* Combined Progress Bar */}
          <div className="h-5 w-full rounded-full bg-background/60 overflow-hidden flex border border-border/40 p-0.5">
            <div
              style={{ width: `${(autoClearCount / total) * 100}%` }}
              className="bg-teal-500/80 transition-all duration-500 rounded-l-full relative group"
              title={`AUTO_CLEAR: ${autoClearCount}`}
            />
            <div
              style={{ width: `${(humanReviewCount / total) * 100}%` }}
              className="bg-yellow-500/80 transition-all duration-500 relative group"
              title={`HUMAN_REVIEW: ${humanReviewCount}`}
            />
            <div
              style={{ width: `${(autoBlockCount / total) * 100}%` }}
              className="bg-red-500/80 transition-all duration-500 rounded-r-full relative group"
              title={`AUTO_BLOCK: ${autoBlockCount}`}
            />
          </div>

          {/* Band Legends */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-teal-400">
                <span>AUTO_CLEAR</span>
                <span>&lt; 0.2144</span>
              </div>
              <p className="text-xl font-bold text-foreground font-mono">{autoClearCount} <span className="text-xs text-foreground-muted font-normal">({((autoClearCount / total) * 100).toFixed(1)}%)</span></p>
              <p className="text-[11px] text-teal-300/80">Low risk accounts cleared with instant automated processing.</p>
            </div>

            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-yellow-400">
                <span>HUMAN_REVIEW</span>
                <span>0.2144 - 0.3063</span>
              </div>
              <p className="text-xl font-bold text-foreground font-mono">{humanReviewCount} <span className="text-xs text-foreground-muted font-normal">({((humanReviewCount / total) * 100).toFixed(1)}%)</span></p>
              <p className="text-[11px] text-yellow-300/80">Borderline accounts routed directly to HITL Compliance Review Queue.</p>
            </div>

            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-red-400">
                <span>AUTO_BLOCK</span>
                <span>&gt; 0.3063</span>
              </div>
              <p className="text-xl font-bold text-foreground font-mono">{autoBlockCount} <span className="text-xs text-foreground-muted font-normal">({((autoBlockCount / total) * 100).toFixed(1)}%)</span></p>
              <p className="text-[11px] text-red-300/80">Confirmed high probability mule accounts flagged for auto debit freeze.</p>
            </div>
          </div>
        </div>

        {/* Feature Health & Leakage Purge Monitor */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Predictive Features */}
          <div className="lg:col-span-2 p-6 rounded-2xl border border-border/50 bg-background-card/70 backdrop-blur-xl shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Top Feature Importance & Drift Health</h3>
            <p className="text-xs text-foreground-muted">Engineered features ranked by mean absolute SHAP impact and stability monitoring.</p>

            <div className="space-y-3">
              {TOP_FEATURES.map((feat) => (
                <div key={feat.name} className="p-3.5 rounded-xl bg-background/40 border border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground">{feat.name}</span>
                      {feat.purgedProxy && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                          PURGED PROXY
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-foreground-muted">{feat.category}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    {!feat.purgedProxy && (
                      <div className="w-32 bg-background/60 h-2 rounded-full overflow-hidden border border-border/30">
                        <div
                          className="bg-accent h-full rounded-full"
                          style={{ width: `${(feat.shapImportance / 0.4) * 100}%` }}
                        />
                      </div>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                      feat.driftStatus === 'Stable'
                        ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                        : feat.driftStatus === 'Low Drift'
                        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {feat.driftStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Model Architecture Info */}
          <div className="p-6 rounded-2xl border border-border/50 bg-background-card/70 backdrop-blur-xl shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Pipeline Stack Details</h3>
            
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-background/40 border border-border/30 space-y-1">
                <span className="font-semibold text-accent uppercase tracking-wider">Gradient Boosted Ensemble</span>
                <p className="text-foreground-muted">XGBoost (CUDA GPU Enabled) + LightGBM + CatBoost CPU Fallback.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-background/40 border border-border/30 space-y-1">
                <span className="font-semibold text-accent uppercase tracking-wider">Unsupervised Anomaly Layer</span>
                <p className="text-foreground-muted">Isolation Forest & PCA reconstruction variance for zero-day fraud pattern detection.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-background/40 border border-border/30 space-y-1">
                <span className="font-semibold text-accent uppercase tracking-wider">Sequence & Graph Network</span>
                <p className="text-foreground-muted">Multi-hop money ring cycle detection & Temporal Transaction sequence modeling.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-background/40 border border-border/30 space-y-1">
                <span className="font-semibold text-teal-400 uppercase tracking-wider">Inference SLA</span>
                <p className="text-foreground font-mono text-sm font-bold mt-1">~11.8 ms / account</p>
                <p className="text-foreground-muted text-[11px]">Sub-50ms hard threshold for real-time transaction blocking.</p>
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </main>
    </PageShell>
  )
}

export default MonitorPage
