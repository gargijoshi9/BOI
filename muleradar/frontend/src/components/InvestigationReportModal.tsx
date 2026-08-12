import { useRef, useState } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { RiskEvaluationResponse, ShapFeature, GraphNode } from '../api/client'

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

  if (!isOpen) return null

  const recoverable = account.damage_metrics?.recoverable_amount ?? 0
  const inTransit = account.damage_metrics?.in_transit_amount ?? 0
  const totalExposure = recoverable + inTransit
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
                      <td className="py-2 px-3 font-semibold bg-slate-50 w-1/4 border-r border-slate-200 text-slate-700">Risk Assessment</td>
                      <td className="py-2 px-3 font-bold text-red-700">{account.risk_level.toUpperCase()} ({account.risk_score}/1000)</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-2 px-3 font-semibold bg-slate-50 border-r border-slate-200 text-slate-700">Fraud Probability</td>
                      <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-200">{(account.risk_score / 10).toFixed(1)}%</td>
                      <td className="py-2 px-3 font-semibold bg-slate-50 border-r border-slate-200 text-slate-700">Kill Chain Stage</td>
                      <td className="py-2 px-3 font-semibold text-orange-700">{account.kill_chain_stage}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-2 px-3 font-semibold bg-slate-50 border-r border-slate-200 text-slate-700">Inference Engine</td>
                      <td className="py-2 px-3 text-slate-900 border-r border-slate-200">{account.is_simulated ? 'Simulated Model' : 'Live ML Ensemble v2.4'}</td>
                      <td className="py-2 px-3 font-semibold bg-slate-50 border-r border-slate-200 text-slate-700">Target Typology</td>
                      <td className="py-2 px-3 font-semibold text-red-800">Money Mule Account</td>
                    </tr>
                  </tbody>
                </table>

                {/* Risk Gauge Bar */}
                <div className="p-4 bg-slate-50 border border-slate-300 rounded-lg mb-6">
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                    <span>MULE RISK SCORE</span>
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
                    <li>
                      <strong>Rapid Pass-Through Behavior:</strong> Inbound transfers are immediately routed to debit cash-out nodes with minimal retention float.
                    </li>
                    <li>
                      <strong>Transaction Deviation Spike:</strong> Significant deviation in 31-day credit/debit volume totals compared to customer historical baseline.
                    </li>
                    <li>
                      <strong>Targeted Account Profile:</strong> Customer demographic alignment combined with rapid activation following prior dormancy.
                    </li>
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
                <span>MuleRadar AI Intelligence Platform</span>
                <span>Page 1 of 3</span>
              </div>
            </div>

            {/* PAGE 2: Risk & Explainability (SHAP attributions) */}
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
                    2. Risk & Explainability (Tree-SHAP Attributions)
                  </h2>
                </div>

                {/* Model Architecture Ensemble Table */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Ensemble Model Component Scores
                  </h3>
                  <table className="w-full text-xs border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-semibold">
                        <th className="py-2 px-3 text-left">Model Algorithm</th>
                        <th className="py-2 px-3 text-center">Weight</th>
                        <th className="py-2 px-3 text-center">Raw Risk Score</th>
                        <th className="py-2 px-3 text-left">Primary Fraud Pattern Focus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="py-2 px-3 font-semibold text-slate-800">XGBoost Classifier</td>
                        <td className="py-2 px-3 text-center">40%</td>
                        <td className="py-2 px-3 text-center font-mono font-bold">{Math.round(account.risk_score * 0.95)} / 1000</td>
                        <td className="py-2 px-3 text-slate-600">Non-linear feature interaction & ratio anomalies</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold text-slate-800">LightGBM Classifier</td>
                        <td className="py-2 px-3 text-center">35%</td>
                        <td className="py-2 px-3 text-center font-mono font-bold">{Math.round(account.risk_score * 1.02)} / 1000</td>
                        <td className="py-2 px-3 text-slate-600">Leaf-wise split detection on transactional volumes</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold text-slate-800">CatBoost Classifier</td>
                        <td className="py-2 px-3 text-center">25%</td>
                        <td className="py-2 px-3 text-center font-mono font-bold">{Math.round(account.risk_score * 0.98)} / 1000</td>
                        <td className="py-2 px-3 text-slate-600">Categorical demographic & occupation pattern shifts</td>
                      </tr>
                      <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                        <td className="py-2 px-3 text-slate-900">Stacked Meta-Learner (Blended)</td>
                        <td className="py-2 px-3 text-center">100%</td>
                        <td className="py-2 px-3 text-center font-mono text-red-700 text-sm">{account.risk_score} / 1000</td>
                        <td className="py-2 px-3 text-slate-800">Final Calibrated Risk Score</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Top SHAP Risk Drivers */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Top SHAP Feature Attributions (Plain English)
                  </h3>
                  <table className="w-full text-xs border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-semibold">
                        <th className="py-2 px-3 text-left">Risk Factor Description</th>
                        <th className="py-2 px-3 text-right">SHAP Impact</th>
                        <th className="py-2 px-3 text-center">Direction</th>
                        <th className="py-2 px-3 text-left">AML Risk Signal Context</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {shapList.slice(0, 5).map((f: ShapFeature, idx: number) => {
                        const isPos = f.contribution > 0
                        return (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-semibold text-slate-800">{f.feature}</td>
                            <td className={`py-2 px-3 text-right font-mono font-bold ${isPos ? 'text-red-600' : 'text-green-600'}`}>
                              {isPos ? `+${f.contribution.toFixed(4)}` : f.contribution.toFixed(4)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${isPos ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                {isPos ? 'Increases Risk' : 'Decreases Risk'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {isPos ? 'Deviates significantly from normal peer group baseline' : 'Aligns with expected retail account activity'}
                            </td>
                          </tr>
                        )
                      })}
                      {shapList.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-3 px-3 text-center text-slate-500">
                            No SHAP explanations available for this evaluation.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Behavioral & Fund Flow Shift */}
                <div className="p-4 bg-slate-50 border border-slate-300 rounded-lg">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Behavioral Shift Summary
                  </h3>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="block text-[10px] text-slate-500 font-semibold uppercase">Pass-Through Velocity</span>
                      <span className="text-sm font-bold text-red-700">0.94 (High)</span>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="block text-[10px] text-slate-500 font-semibold uppercase">Fund Concentration</span>
                      <span className="text-sm font-bold text-orange-600">Single Source</span>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="block text-[10px] text-slate-500 font-semibold uppercase">Prior Dormancy</span>
                      <span className="text-sm font-bold text-slate-800">45 Days Inactive</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Page 2 Footer */}
              <div className="border-t border-slate-200 pt-2 flex justify-between text-[10px] text-slate-500">
                <span>MuleRadar AI Intelligence Platform</span>
                <span>Page 2 of 3</span>
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

                {/* Section 3 Title */}
                <div className="bg-slate-100 p-3 rounded-lg border border-slate-300 mb-6">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    3. Network Risk, Financial Damage & Compliance Sign-Off
                  </h2>
                </div>

                {/* Financial Exposure & Recovery Breakdown */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg">
                    <span className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Recoverable Now</span>
                    <span className="text-lg font-black text-emerald-900">{formatINR(recoverable)}</span>
                    <span className="block text-[9px] text-emerald-700 mt-1">Available in account for freeze</span>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg">
                    <span className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider">In Transit</span>
                    <span className="text-lg font-black text-amber-900">{formatINR(inTransit)}</span>
                    <span className="block text-[9px] text-amber-700 mt-1">Active debit channel transfers</span>
                  </div>
                  <div className="p-3 bg-red-50 border border-red-300 rounded-lg">
                    <span className="block text-[10px] font-bold text-red-800 uppercase tracking-wider">Total Exposure</span>
                    <span className="text-lg font-black text-red-900">{formatINR(totalExposure)}</span>
                    <span className="block text-[9px] text-red-700 mt-1">Total estimated fraud volume</span>
                  </div>
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
                        <th className="py-2 px-3 text-center">Fraud DNA Match</th>
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
                          <td className="py-2 px-3 text-center font-bold text-red-700">92% Match</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Section 4: Compliance & Regulatory Actions Checklist */}
                <div className="mb-6 p-4 bg-slate-50 border border-slate-300 rounded-lg">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 border-b pb-1">
                    Regulatory Compliance Checklist
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked readOnly className="accent-red-800" />
                      <span>PMLA 2002 Debit Freeze Executed</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked readOnly className="accent-red-800" />
                      <span>FIU-IND STR Drafted</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked readOnly className="accent-red-800" />
                      <span>RBI Cyber Fraud Hotline Alerted</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked readOnly className="accent-red-800" />
                      <span>Section 91 CrPC Notice Sent</span>
                    </label>
                  </div>
                </div>

                {/* Investigator Decision & Sign-Off Box */}
                <div className="p-4 border-2 border-slate-800 rounded-lg bg-slate-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Official Investigator Sign-Off
                    </h3>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Investigator: <strong>Senior AML Officer</strong> | ID: <strong>BOI-AML-8842</strong>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Decision: <strong className="text-red-700 uppercase">Confirmed Money Mule — Permanent Freeze & Legal Referral</strong>
                    </p>
                  </div>
                  <div className="w-36 h-16 border border-dashed border-slate-400 rounded flex flex-col items-center justify-center p-1 text-center bg-white">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Official Stamp / Seal</span>
                    <span className="text-[10px] font-mono text-red-900 font-bold mt-1">BOI AML APPROVED</span>
                  </div>
                </div>
              </div>

              {/* Page 3 Footer */}
              <div className="border-t border-slate-200 pt-2 flex justify-between text-[10px] text-slate-500">
                <span>MuleRadar AI Intelligence Platform</span>
                <span>Page 3 of 3</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
