import { useState, useRef, ChangeEvent, DragEvent } from 'react'
import PageShell from '../components/PageShell'
import { validateDataset, ValidationResponse, RiskEvaluationResponse, RiskLevel } from '../api/client'

const RISK_COLORS: Record<RiskLevel, string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
}

function ValidationPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState<'ALL' | RiskLevel>('ALL')
  const [selectedItem, setSelectedItem] = useState<RiskEvaluationResponse | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a valid CSV file.')
      return
    }
    setFile(selectedFile)
    setError(null)
  }

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleUploadAndValidate = async () => {
    if (!file) return
    setIsValidating(true)
    setError(null)
    try {
      const response = await validateDataset(file)
      setValidationResult(response)
    } catch (err: any) {
      let errorMessage = err.message || 'Failed to process and validate CSV dataset.'
      if (err?.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail
        } else if (Array.isArray(err.response.data.detail)) {
          // FastAPI returns an array of validation errors for 422
          errorMessage = err.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ')
        }
      }
      setError(errorMessage)
    } finally {
      setIsValidating(false)
    }
  }

  const filteredResults = (validationResult?.results || []).filter(item => {
    const matchesSearch = searchQuery === '' || item.account_id.toLowerCase() === searchQuery.toLowerCase()
    const matchesRisk = riskFilter === 'ALL' || item.risk_level === riskFilter
    return matchesSearch && matchesRisk
  })

  const handleDownloadCSV = () => {
    if (!validationResult || !validationResult.results) return
    const headers = ['Account ID', 'Risk Score (%)', 'Risk Level', 'HITL Band']
    const rows = validationResult.results.map(row => [
      row.account_id,
      (row.risk_score / 10).toFixed(1),
      row.risk_level,
      row.human_review?.confidence_band || ''
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `validation_results_${validationResult.filename.replace('.csv', '')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const muleCount = (validationResult?.results || []).filter(r => r.risk_score >= 450).length
  const criticalCount = (validationResult?.results || []).filter(r => r.risk_level === 'Critical').length
  const highCount = (validationResult?.results || []).filter(r => r.risk_level === 'High').length

  return (
    <PageShell>
      <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-accent/10 border border-accent/20 text-accent text-xs font-semibold tracking-wide uppercase">
                Data Assurance & Schema Verification
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mt-2 tracking-tight">
              Dataset CSV Validation & Batch Evaluation
            </h1>
            <p className="text-body-sm text-foreground-muted mt-1">
              Upload raw transaction/account CSV batches to verify schema compatibility, feature integrity, and execute real-time batch ML risk scoring.
            </p>
          </div>
        </div>

        {/* Upload Container */}
        <div className="rounded-2xl border border-border/50 bg-background-card/60 backdrop-blur-xl p-6 lg:p-8 shadow-xl">
          <div
            onDragOver={onDragOver}
            onDrop={onDrop}
            className="border-2 border-dashed border-border/80 hover:border-accent/50 transition-colors rounded-xl p-8 text-center flex flex-col items-center justify-center bg-background/30 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileChange}
              accept=".csv"
              className="hidden"
            />
            <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center text-accent mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-body-md font-semibold text-foreground">
              {file ? file.name : 'Click to select or drag and drop dataset CSV file here'}
            </p>
            <p className="text-body-sm text-foreground-muted mt-1">
              Supports standard BOI account behavior features & historical transaction export CSVs.
            </p>
            {file && (
              <span className="mt-3 px-3 py-1 bg-teal-500/10 text-teal-400 text-xs font-mono rounded-full border border-teal-500/20">
                Selected: {(file.size / 1024).toFixed(1)} KB
              </span>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            {file && (
              <button
                onClick={() => { setFile(null); setValidationResult(null); setError(null); }}
                className="px-4 py-2.5 rounded-xl border border-border/60 text-foreground-muted hover:text-foreground text-sm font-medium transition"
              >
                Clear File
              </button>
            )}
            <button
              onClick={handleUploadAndValidate}
              disabled={!file || isValidating}
              className={`px-6 py-2.5 rounded-xl text-navy-950 font-semibold text-sm transition-all shadow-glow-teal flex items-center gap-2 ${
                !file || isValidating
                  ? 'bg-accent/40 cursor-not-allowed text-navy-950/60'
                  : 'bg-accent hover:bg-accent-hover'
              }`}
            >
              {isValidating ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-navy-950" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Validating & Scoring Batch...
                </>
              ) : (
                'Run Validation & ML Batch Scoring'
              )}
            </button>
          </div>
        </div>

        {/* Validation Results Display */}
        {validationResult && (
          <div className="space-y-6">
            {/* KPI Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-background-card/80 border border-border/50">
                <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Total Rows Evaluated</p>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-3xl font-bold text-foreground">{validationResult.n_rows.toLocaleString()}</span>
                  <span className="text-xs text-accent font-mono">100% Parsed</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-background-card/80 border border-border/50">
                <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Mule Account Detections</p>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-3xl font-bold text-red-400">{muleCount}</span>
                  <span className="text-xs text-red-400 font-medium">({((muleCount / validationResult.n_rows) * 100).toFixed(1)}% rate)</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-background-card/80 border border-border/50">
                <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">High Risk / Critical</p>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-3xl font-bold text-orange-400">{criticalCount + highCount}</span>
                  <span className="text-xs text-orange-400 font-medium">Review Queued</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-background-card/80 border border-border/50">
                <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Schema Feature Alignment</p>
                <div className="flex items-baseline justify-between mt-2">
                  <span className={`text-2xl font-bold ${validationResult.warnings.missing_columns.length === 0 ? 'text-teal-400' : 'text-yellow-400'}`}>
                    {validationResult.warnings.missing_columns.length === 0 ? '100% Match' : `${validationResult.warnings.missing_columns.length} Missing`}
                  </span>
                  <span className="text-xs text-foreground-muted font-mono">{validationResult.warnings.extra_columns_ignored} Extra Ignored</span>
                </div>
              </div>
            </div>

            {/* Methodology & Disclaimer Callout */}
            <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm space-y-2">
              <div className="flex items-center gap-2 font-semibold text-blue-200">
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Methodology & Anti-Leakage Assurance Notice
              </div>
              <p className="text-body-sm leading-relaxed text-blue-300/90">
                {validationResult.methodology_note}
              </p>
            </div>

            {/* Batch Table Container */}
            <div className="rounded-2xl border border-border/50 bg-background-card/70 backdrop-blur-xl overflow-hidden shadow-xl">
              <div className="p-5 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Scored Batch Results</h3>
                  <p className="text-xs text-foreground-muted">Filename: <span className="font-mono text-accent">{validationResult.filename}</span></p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Download CSV Button */}
                  <button
                    onClick={handleDownloadCSV}
                    className="px-3.5 py-1.5 rounded-xl bg-accent/10 border border-accent/20 text-accent hover:bg-accent hover:text-navy-950 text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export CSV
                  </button>

                  {/* Search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search Account ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-48 sm:w-64 px-3.5 py-1.5 rounded-xl bg-background/50 border border-border/60 text-xs text-foreground placeholder-foreground-muted focus:outline-none focus:border-accent"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center bg-background/50 p-1 rounded-xl border border-border/50 gap-1">
                    {(['ALL', 'Critical', 'High', 'Medium', 'Low'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRiskFilter(r)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                          riskFilter === r
                            ? 'bg-accent text-navy-950 font-semibold'
                            : 'text-foreground-muted hover:text-foreground'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-foreground">
                  <thead className="bg-background/80 text-foreground-muted uppercase tracking-wider border-b border-border/50">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Account ID</th>
                      <th className="px-5 py-3.5 font-semibold">Risk Score</th>
                      <th className="px-5 py-3.5 font-semibold">Risk Level</th>
                      <th className="px-5 py-3.5 font-semibold">HITL Band</th>
                      <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredResults.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-foreground-muted">
                          No matching records found in this batch.
                        </td>
                      </tr>
                    ) : (
                      filteredResults.slice(0, 100).map((row) => (
                        <tr key={row.account_id} className="hover:bg-accent/5 transition-colors">
                          <td className="px-5 py-3.5 font-mono font-semibold text-foreground">{row.account_id}</td>
                          <td className="px-5 py-3.5">
                            <span className="font-mono font-bold text-body-sm" style={{ color: RISK_COLORS[row.risk_level] }}>
                              {(row.risk_score / 10).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className="px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide uppercase"
                              style={{
                                backgroundColor: `${RISK_COLORS[row.risk_level]}15`,
                                color: RISK_COLORS[row.risk_level],
                                border: `1px solid ${RISK_COLORS[row.risk_level]}30`,
                              }}
                            >
                              {row.risk_level}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-background border border-border/60 text-foreground-muted">
                              {row.human_review.confidence_band}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setSelectedItem(row)}
                              className="px-3 py-1 rounded-lg bg-accent/10 border border-accent/20 text-accent hover:bg-accent hover:text-navy-950 font-medium transition text-xs"
                            >
                              Inspect Row
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {filteredResults.length > 100 && (
                <div className="p-3 text-center text-xs text-foreground-muted bg-background/30 border-t border-border/40">
                  Showing top 100 of {filteredResults.length} records. Filter or search to refine display.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Row Detail Drawer Modal */}
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="w-full max-w-2xl bg-background-card border border-border/60 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <div>
                  <span className="text-xs text-accent font-mono uppercase tracking-wider">Batch Account Details</span>
                  <h3 className="text-xl font-bold text-foreground font-mono">{selectedItem.account_id}</h3>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 text-foreground-muted hover:text-foreground rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-1">
                  <p className="text-xs text-foreground-muted uppercase">Risk Level & Score</p>
                  <p className="text-lg font-bold" style={{ color: RISK_COLORS[selectedItem.risk_level] }}>
                    {selectedItem.risk_level} ({(selectedItem.risk_score / 10).toFixed(1)}%)
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-1">
                  <p className="text-xs text-foreground-muted uppercase">HITL Confidence Band</p>
                  <p className="text-sm font-mono font-semibold text-accent">{selectedItem.human_review.confidence_band}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Top Risk Features (SHAP Values)</h4>
                <div className="space-y-2">
                  {selectedItem.shap_explanation.map((feat, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-background/30 border border-border/30">
                      <span className="font-mono text-foreground-muted">{feat.feature}</span>
                      <span className={`font-mono font-bold ${feat.contribution > 0 ? 'text-red-400' : 'text-teal-400'}`}>
                        {feat.contribution > 0 ? `+${feat.contribution.toFixed(4)}` : feat.contribution.toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-5 py-2 rounded-xl bg-accent text-navy-950 font-semibold text-xs hover:bg-accent-hover transition"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </PageShell>
  )
}

export default ValidationPage
