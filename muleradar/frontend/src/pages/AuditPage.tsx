import { useState, useEffect } from 'react'
import PageShell from '../components/PageShell'
import { fetchAuditTrail, ReviewDecisionRecord } from '../api/client'

const DECISION_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  confirm_mule: { label: 'CONFIRMED MULE', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  clear: { label: 'CLEARED / NORMAL', bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30' },
  escalate: { label: 'ESCALATED TO CYBER CELL', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
}

function AuditPage() {
  const [trail, setTrail] = useState<ReviewDecisionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [decisionFilter, setDecisionFilter] = useState<string>('ALL')
  const [selectedRecord, setSelectedRecord] = useState<ReviewDecisionRecord | null>(null)

  useEffect(() => {
    async function loadTrail() {
      try {
        setLoading(true)
        const data = await fetchAuditTrail()
        setTrail(data)
      } catch (err: any) {
        setError('Failed to load audit trail records.')
      } finally {
        setLoading(false)
      }
    }
    loadTrail()
  }, [])

  const filteredTrail = trail.filter(item => {
    const matchesSearch = item.account_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.reviewer_name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDecision = decisionFilter === 'ALL' || item.decision === decisionFilter
    return matchesSearch && matchesDecision
  })

  const totalActions = trail.length
  const confirmedCount = trail.filter(t => t.decision === 'confirm_mule').length
  const clearedCount = trail.filter(t => t.decision === 'clear').length
  const escalatedCount = trail.filter(t => t.decision === 'escalate').length

  return (
    <PageShell>
      <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-accent/10 border border-accent/20 text-accent text-xs font-semibold tracking-wide uppercase">
                Regulatory Compliance & Chain of Custody
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mt-2 tracking-tight">
              Risk Review Centre Trail & Action History
            </h1>
            <p className="text-body-sm text-foreground-muted mt-1">
              Immutable logging of compliance investigator decisions, account freeze actions, and SAR filings.
            </p>
          </div>
        </div>

        {/* KPI Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-background-card/80 border border-border/50 shadow-xl space-y-1">
            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Total Reviewed Actions</p>
            <span className="text-3xl font-bold text-foreground font-mono">{totalActions}</span>
          </div>

          <div className="p-5 rounded-2xl bg-background-card/80 border border-border/50 shadow-xl space-y-1">
            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Confirmed Mule Freezes</p>
            <span className="text-3xl font-bold text-red-400 font-mono">{confirmedCount}</span>
          </div>

          <div className="p-5 rounded-2xl bg-background-card/80 border border-border/50 shadow-xl space-y-1">
            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Cleared False Positives</p>
            <span className="text-3xl font-bold text-teal-400 font-mono">{clearedCount}</span>
          </div>

          <div className="p-5 rounded-2xl bg-background-card/80 border border-border/50 shadow-xl space-y-1">
            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Cyber Cell Escalations</p>
            <span className="text-3xl font-bold text-purple-400 font-mono">{escalatedCount}</span>
          </div>
        </div>

        {/* Main Audit Log Table */}
        <div className="rounded-2xl border border-border/50 bg-background-card/70 backdrop-blur-xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Compliance Action Log</h3>
              <p className="text-xs text-foreground-muted">Persisted audit record containing reviewer signatures and model state</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <input
                type="text"
                placeholder="Search Account ID or Reviewer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-64 px-3.5 py-1.5 rounded-xl bg-background/50 border border-border/60 text-xs text-foreground placeholder-foreground-muted focus:outline-none focus:border-accent"
              />

              {/* Filter */}
              <div className="flex items-center bg-background/50 p-1 rounded-xl border border-border/50 gap-1">
                {(['ALL', 'confirm_mule', 'clear', 'escalate'] as const).map((dec) => (
                  <button
                    key={dec}
                    onClick={() => setDecisionFilter(dec)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${decisionFilter === dec
                        ? 'bg-accent text-navy-950 font-semibold'
                        : 'text-foreground-muted hover:text-foreground'
                      }`}
                  >
                    {dec === 'ALL' ? 'ALL' : dec === 'confirm_mule' ? 'MULE' : dec.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-foreground-muted space-y-3">
              <svg className="animate-spin h-6 w-6 text-accent mx-auto" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-xs">Fetching compliance audit trail...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-400 text-sm font-medium">
              {error}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-background/80 text-foreground-muted uppercase tracking-wider border-b border-border/50">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Timestamp</th>
                    <th className="px-5 py-3.5 font-semibold">Account ID</th>
                    <th className="px-5 py-3.5 font-semibold">Compliance Action</th>
                    <th className="px-5 py-3.5 font-semibold">Reviewer Name</th>
                    <th className="px-5 py-3.5 font-semibold">Model Risk Score</th>
                    <th className="px-5 py-3.5 font-semibold">Investigator Notes</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredTrail.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-foreground-muted">
                        No audit records found. Resolve items in the Investigation Queue to populate audit records.
                      </td>
                    </tr>
                  ) : (
                    filteredTrail.map((record, i) => {
                      const badge = DECISION_BADGES[record.decision] || {
                        label: record.decision,
                        bg: 'bg-background',
                        text: 'text-foreground-muted',
                        border: 'border-border',
                      }
                      return (
                        <tr key={i} className="hover:bg-accent/5 transition-colors">
                          <td className="px-5 py-3.5 font-mono text-foreground-muted">
                            {new Date(record.timestamp).toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 font-mono font-semibold text-foreground">
                            {record.account_id}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wider ${badge.bg} ${badge.text} border ${badge.border}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-foreground">
                            {record.reviewer_name}
                          </td>
                          <td className="px-5 py-3.5 font-mono font-bold text-accent">
                            {(record.model_risk_score * 100).toFixed(1)}%
                          </td>
                          <td className="px-5 py-3.5 text-foreground-muted max-w-xs truncate">
                            {record.note || 'No notes attached.'}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setSelectedRecord(record)}
                              className="px-3 py-1 rounded-lg bg-accent/10 border border-accent/20 text-accent hover:bg-accent hover:text-navy-950 font-medium transition text-xs"
                            >
                              View Record
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Audit Record Modal */}
        {selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="w-full max-w-xl bg-background-card border border-border/60 rounded-2xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <div>
                  <span className="text-xs text-accent font-mono uppercase tracking-wider">Audit Log Record</span>
                  <h3 className="text-xl font-bold text-foreground font-mono">{selectedRecord.account_id}</h3>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-1 text-foreground-muted hover:text-foreground rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-background/50 border border-border/40 flex justify-between items-center">
                  <span className="text-foreground-muted">Action Timestamp</span>
                  <span className="font-mono text-foreground">{new Date(selectedRecord.timestamp).toUTCString()}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-background/50 border border-border/40 flex justify-between items-center">
                  <span className="text-foreground-muted">Decision Recorded</span>
                  <span className="font-semibold uppercase text-accent">{selectedRecord.decision}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-background/50 border border-border/40 flex justify-between items-center">
                  <span className="text-foreground-muted">Compliance Officer</span>
                  <span className="font-semibold text-foreground">{selectedRecord.reviewer_name}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-background/50 border border-border/40 flex justify-between items-center">
                  <span className="text-foreground-muted">Model Risk Score at Action</span>
                  <span className="font-mono font-bold text-accent">{(selectedRecord.model_risk_score * 100).toFixed(2)}%</span>
                </div>

                <div className="p-3.5 rounded-xl bg-background/50 border border-border/40 space-y-1">
                  <span className="text-foreground-muted uppercase tracking-wider text-[10px]">Investigator Case Note</span>
                  <p className="text-foreground text-xs leading-relaxed">{selectedRecord.note || 'None provided.'}</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="px-5 py-2 rounded-xl bg-accent text-navy-950 font-semibold text-xs hover:bg-accent-hover transition"
                >
                  Close Record
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </PageShell>
  )
}

export default AuditPage
