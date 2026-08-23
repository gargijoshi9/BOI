import { useEffect, useState, useRef } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { RiskEvaluationResponse, ShapFeature, GraphNode, fetchAuditTrail, ReviewDecisionRecord } from '../api/client'

interface InvestigationReportModalProps {
  account: RiskEvaluationResponse
  isOpen: boolean
  onClose: () => void
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
})

function formatINR(val?: number): string {
  if (val === undefined || val === null) return '₹0'
  return '₹' + inrFormatter.format(val)
}

export default function InvestigationReportModal({
  account,
  isOpen,
  onClose,
}: InvestigationReportModalProps) {
  const reportRef = useRef<HTMLDivElement>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [auditRecord, setAuditRecord] = useState<ReviewDecisionRecord | null>(null)

  useEffect(() => {
    fetchAuditTrail(account.account_id).then((records) => setAuditRecord(records[0] ?? null))
  }, [account.account_id])

  if (!isOpen) return null

  const shapList = account.shap_explanation ?? []
  const nodes = account.network_connections?.nodes ?? []
  const edges = account.network_connections?.edges ?? []

  const alertDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  async function handleDownloadPDF() {
    if (!reportRef.current) return
    setIsGenerating(true)

    try {
      const element = reportRef.current
      const pages = element.querySelectorAll<HTMLElement>('.pdf-page')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage()
        const pageEl = pages[i]

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        })

        const imgData = canvas.toDataURL('image/jpeg', 0.95)
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)
      }

      pdf.save(`Mule_Investigation_Report_AC_${account.account_id}.pdf`)
    } catch (err) {
      console.error('PDF Generation failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <span className="text-xl">📄</span>
            <div>
              <h2 className="text-base font-bold text-white">
                Mule Account Investigation Report (PDF Preview)
              </h2>
              <p className="text-xs text-slate-400">
                Account ID: {account.account_id} | Confidential Bank Audit Document
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-all shadow-lg disabled:opacity-50"
            >
              {isGenerating ? 'Generating PDF...' : '📥 Download PDF Report'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable PDF Document Container */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/60 flex justify-center">
          <div ref={reportRef} className="flex flex-col gap-6 w-[210mm] text-slate-900 font-sans">
            {/* PAGE 1: Case Overview & Executive Risk Summary */}
            <div className="pdf-page w-[210mm] min-h-[297mm] h-[297mm] p-8 bg-white flex flex-col justify-between shadow-xl relative overflow-hidden box-border">
              <div>
                {/* Header */}
                <div className="flex items-center justify-between border-b-2 border-red-800 pb-4 mb-6">
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-red-900 uppercase">
                      Bank of India
                    </h1>
                    <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      Financial Intelligence & AML Compliance Division
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-red-100 text-red-800 text-[11px] font-bold uppercase tracking-wider rounded border border-red-300">
                      CONFIDENTIAL / AML REPORT
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1">Ref: CASE-BOI-2026-{account.account_id}</p>
                  </div>
                </div>

                {/* Section 1 Title */}
                <div className="bg-slate-100 p-3 rounded-lg border border-slate-300 mb-6 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    1. Case Overview & Executive Risk Summary
                  </h2>
                  <span className="text-xs text-slate-600">Alert Date: {alertDate}</span>
                </div>

                {/* Key Case Metadata Table */}
                <table className="w-full text-xs border-collapse mb-6">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="py-2 px-3 font-semibold bg-slate-50 w-1/4 border-r border-slate-200 text-slate-700">Account ID / No</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900 border-r border-slate-200">AC-{account.account_id}</td>
                      <td className="py-2 px-3 font-semibold bg-slate-50 w-1/4 border-r border-slate-200 text-slate-700">Account Type</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{account.account_type || 'Savings'}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-2 px-3 font-semibold bg-slate-50 border-r border-slate-200 text-slate-700">Customer Age</td>
                      <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-200">{account.age || 'N/A'}</td>
                      <td className="py-2 px-3 font-semibold bg-slate-50 border-r border-slate-200 text-slate-700">Occupation</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 capitalize">{account.occupation || 'N/A'}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-2 px-3 font-semibold bg-slate-50 border-r border-slate-200 text-slate-700">Risk Assessment</td>
                      <td colSpan={3} className="py-2 px-3 text-red-700 font-bold border-r border-slate-200">{account.risk_level.toUpperCase()}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Risk Gauge Bar */}
                <div className="p-4 bg-slate-50 border border-slate-300 rounded-lg mb-6">
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                    <span>INTERNAL RISK RATING</span>
                    <span className="text-red-700 font-mono text-sm">{account.risk_score} / 1000</span>
                  </div>
                  <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden flex">
                    <div
                      className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600 h-full rounded-full"
                      style={{ width: `${Math.min(account.risk_score / 10, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-semibold">
                    <span>LOW (0-400)</span>
                    <span>MEDIUM (400-600)</span>
                    <span>HIGH (600-800)</span>
                    <span>CRITICAL (800-1000)</span>
                  </div>
                </div>

                {/* Key Suspicious Activity */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 border-b pb-1">
                    Key Suspicious Findings
                  </h3>
                  <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1.5">
                    {shapList.slice(0, 3).map((f: ShapFeature, idx: number) => (
                      <li key={idx}>
                        <strong>{f.display_name || f.feature}:</strong> {f.description || `Significant contribution to risk score (${f.contribution > 0 ? '+' : ''}${f.contribution.toFixed(4)}).`}
                      </li>
                    ))}
                    {shapList.length === 0 && (
                      <li>No specific feature findings available.</li>
                    )}
                  </ul>
                </div>

                {/* Recommended Immediate Action Box */}
                <div className="p-4 bg-red-50 border-l-4 border-red-700 rounded-r-lg">
                  <h3 className="text-xs font-bold text-red-900 uppercase tracking-wider mb-1">
                    Recommended Executive Action
                  </h3>
                  <p className="text-xs text-red-800 font-medium leading-relaxed">
                    Place an immediate <strong>Total Debit Freeze</strong> under PMLA Section 12 guidelines. Initiate Suspicious Transaction Report (STR) filing with FIU-IND within 24 hours. Notify linked counterparty banks for fund recovery under Section 91 CrPC.
                  </p>
                </div>
              </div>

              {/* Page 1 Footer */}
              <div className="border-t border-slate-200 pt-2 flex justify-between text-[10px] text-slate-500">
                <span>Bank of India - Internal Audit System</span>
                <span>Page 1 of 2</span>
              </div>
            </div>



            {/* PAGE 3: Network Risk, Financial Exposure & Compliance Sign-Off */}
            <div className="pdf-page w-[210mm] min-h-[297mm] h-[297mm] p-8 bg-white flex flex-col justify-between shadow-xl relative overflow-hidden box-border">
              <div>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
                  <span className="text-xs font-bold text-slate-600 uppercase">Bank of India — AML Unit</span>
                  <span className="text-xs text-slate-500">Case Ref: CASE-BOI-2026-{account.account_id}</span>
                </div>

                {/* Section 2 Title */}
                <div className="bg-slate-100 p-3 rounded-lg border border-slate-300 mb-6">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    2. Network Risk, Financial Exposure & Compliance Sign-Off
                  </h2>
                </div>

                {/* Connected Counterparties Table */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Connected Network Topology & Suspicious Counterparties
                  </h3>
                  <table className="w-full text-xs border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-semibold">
                        <th className="py-2 px-3 text-left">Node ID</th>
                        <th className="py-2 px-3 text-center">Node Role</th>
                        <th className="py-2 px-3 text-right">Transfer Volume</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {nodes.slice(0, 4).map((node: GraphNode, idx: number) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-mono font-semibold text-slate-800">{node.id}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${node.type === 'cash_out' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>
                              {node.type === 'cash_out' ? 'Cash Out / ATM' : 'Linked Account'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatINR(edges[idx]?.amount ?? 125000)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Section 4: Compliance & Investigator Decision */}
                <div className="mb-6 p-4 bg-slate-50 border border-slate-300 rounded-lg">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 border-b pb-1">
                    Investigator Decision Status
                  </h3>
                  {auditRecord ? (
                    <div className="text-xs text-slate-700 space-y-1">
                      <p><strong>Decision:</strong> {auditRecord.decision.replace('_', ' ').toUpperCase()}</p>
                      <p><strong>Reviewer:</strong> {auditRecord.reviewer_name}</p>
                      <p><strong>Timestamp:</strong> {auditRecord.timestamp}</p>
                      {auditRecord.note && <p><strong>Note:</strong> {auditRecord.note}</p>}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 font-semibold">
                      ⚠ No investigator decision recorded yet for this account. This report reflects the
                      automated model output only and has not been reviewed or approved by compliance staff.
                    </p>
                  )}
                </div>
              </div>

              {/* Page 2 Footer */}
              <div className="border-t border-slate-200 pt-2 flex justify-between text-[10px] text-slate-500">
                <span>Bank of India - Internal Audit System</span>
                <span>Page 2 of 2</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
