import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Network, 
  Activity, 
  FileText, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Cpu, 
  Clock,
  Layers,
  HelpCircle,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

// Mock Mule Account Data
const MOCK_MULE_ACCOUNTS = [
  { id: 'ACC-8291-BOI', name: 'R. K. Sharma Enterprises', score: 942, stage: 'Fund Reception', volume: '₹14,20,000', frequency: '24 tx/hr', shadowFlags: 3 },
  { id: 'ACC-1082-BOI', name: 'Amit Verma (Savings)', score: 875, stage: 'Layering', volume: '₹8,50,000', frequency: '18 tx/hr', shadowFlags: 2 },
  { id: 'ACC-9904-BOI', name: 'Stellar Tech Sol (Current)', score: 820, stage: 'Preparation', volume: '₹34,10,000', frequency: '12 tx/hr', shadowFlags: 4 },
  { id: 'ACC-4491-BOI', name: 'Kiran Patel (Student)', score: 790, stage: 'Recruitment', volume: '₹2,10,000', frequency: '8 tx/hr', shadowFlags: 1 },
  { id: 'ACC-6612-BOI', name: 'Apex Logistics (Current)', score: 680, stage: 'Cash-Out', volume: '₹52,00,000', frequency: '45 tx/hr', shadowFlags: 5 },
];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedMule, setSelectedMule] = useState(MOCK_MULE_ACCOUNTS[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMules = MOCK_MULE_ACCOUNTS.filter(mule => 
    mule.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    mule.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col font-sans">
      {/* Top Banner */}
      <header className="border-b border-[#1E293B] bg-[#0E1322] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-gradient-to-tr from-[#EF6820] to-[#FF9052] rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20">
            <ShieldAlert className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              MuleRadar
            </h1>
            <p className="text-xs text-gray-400">BOI Hackathon 2026 • Team Orange</p>
          </div>
        </div>

        {/* Global Stats Capsule */}
        <div className="hidden md:flex items-center space-x-6">
          <div className="text-right">
            <span className="text-xs text-gray-400 block">Total Scanned</span>
            <span className="text-sm font-semibold font-mono text-gray-200">9,842 Accounts</span>
          </div>
          <div className="h-8 w-px bg-gray-800"></div>
          <div className="text-right">
            <span className="text-xs text-gray-400 block">Mule Alerts</span>
            <span className="text-sm font-semibold font-mono text-red-400">81 Confirmed</span>
          </div>
          <div className="h-8 w-px bg-gray-800"></div>
          <div className="text-right">
            <span className="text-xs text-gray-400 block">Detection Precision</span>
            <span className="text-sm font-semibold font-mono text-green-400">98.92%</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Sidebar Nav */}
        <nav className="w-full lg:w-64 border-r border-[#1E293B] bg-[#0E1322] p-4 flex lg:flex-col space-y-1 lg:space-y-2 overflow-x-auto lg:overflow-x-visible">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-3 w-full px-4 py-3 rounded-lg text-sm transition-all whitespace-nowrap ${
              activeTab === 'dashboard' 
                ? 'bg-gradient-to-r from-[#EF6820]/20 to-[#EF6820]/5 text-[#EF6820] border-l-2 border-[#EF6820] font-medium' 
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Operational Console</span>
          </button>
          <button 
            onClick={() => setActiveTab('dna')}
            className={`flex items-center space-x-3 w-full px-4 py-3 rounded-lg text-sm transition-all whitespace-nowrap ${
              activeTab === 'dna' 
                ? 'bg-gradient-to-r from-[#EF6820]/20 to-[#EF6820]/5 text-[#EF6820] border-l-2 border-[#EF6820] font-medium' 
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
            }`}
          >
            <Cpu className="h-4 w-4" />
            <span>Behavioral DNA</span>
          </button>
          <button 
            onClick={() => setActiveTab('graph')}
            className={`flex items-center space-x-3 w-full px-4 py-3 rounded-lg text-sm transition-all whitespace-nowrap ${
              activeTab === 'graph' 
                ? 'bg-gradient-to-r from-[#EF6820]/20 to-[#EF6820]/5 text-[#EF6820] border-l-2 border-[#EF6820] font-medium' 
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
            }`}
          >
            <Network className="h-4 w-4" />
            <span>GNN Ring Analysis</span>
          </button>
          <button 
            onClick={() => setActiveTab('copilot')}
            className={`flex items-center space-x-3 w-full px-4 py-3 rounded-lg text-sm transition-all whitespace-nowrap ${
              activeTab === 'copilot' 
                ? 'bg-gradient-to-r from-[#EF6820]/20 to-[#EF6820]/5 text-[#EF6820] border-l-2 border-[#EF6820] font-medium' 
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>AI Copilot & XAI</span>
          </button>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* TAB 1: OPERATIONAL CONSOLE */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Quick stats section */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#111827] border border-[#1E293B] p-5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-gray-400 text-xs font-medium">Risk Score Threshold</span>
                    <h3 className="text-2xl font-bold mt-1 text-red-500 font-mono">&gt; 750</h3>
                  </div>
                  <div className="p-3 bg-red-950/40 text-red-400 rounded-lg">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                </div>
                <div className="bg-[#111827] border border-[#1E293B] p-5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-gray-400 text-xs font-medium">Pending Analyst Review</span>
                    <h3 className="text-2xl font-bold mt-1 font-mono text-yellow-400">14 cases</h3>
                  </div>
                  <div className="p-3 bg-yellow-950/40 text-yellow-400 rounded-lg">
                    <Clock className="h-6 w-6" />
                  </div>
                </div>
                <div className="bg-[#111827] border border-[#1E293B] p-5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-gray-400 text-xs font-medium">Data Pipeline Latency</span>
                    <h3 className="text-2xl font-bold mt-1 font-mono text-green-400">120ms</h3>
                  </div>
                  <div className="p-3 bg-green-950/40 text-green-400 rounded-lg">
                    <Activity className="h-6 w-6" />
                  </div>
                </div>
                <div className="bg-[#111827] border border-[#1E293B] p-5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-gray-400 text-xs font-medium">Est. Prevented Loss</span>
                    <h3 className="text-2xl font-bold mt-1 font-mono text-orange-400">₹2.41 Cr</h3>
                  </div>
                  <div className="p-3 bg-orange-950/40 text-[#EF6820] rounded-lg">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* Main alert table + Analyst Panel */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* List block */}
                <div className="xl:col-span-2 bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-[#1E293B] bg-[#0E1322] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <h2 className="font-semibold text-gray-200">High Risk Suspicious Accounts</h2>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Search Account No / Name..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-[#1F2937] border border-[#374151] rounded-lg pl-9 pr-4 py-2 w-full text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#EF6820]"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#1E293B] bg-[#0E1322]/50 text-gray-400 font-semibold uppercase">
                          <th className="p-4">Account ID</th>
                          <th className="p-4">Entity</th>
                          <th className="p-4">Risk score</th>
                          <th className="p-4">Est. Stage</th>
                          <th className="p-4">Tx Volume</th>
                          <th className="p-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B]/60">
                        {filteredMules.map((mule) => (
                          <tr 
                            key={mule.id} 
                            onClick={() => setSelectedMule(mule)}
                            className={`hover:bg-gray-800/40 transition-colors cursor-pointer ${selectedMule.id === mule.id ? 'bg-[#EF6820]/5' : ''}`}
                          >
                            <td className="p-4 font-mono font-bold text-gray-300">{mule.id}</td>
                            <td className="p-4 font-medium text-gray-200">{mule.name}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded font-mono font-semibold ${
                                mule.score > 900 ? 'bg-red-950/40 text-red-400' : 'bg-orange-950/40 text-orange-400'
                              }`}>
                                {mule.score}/1000
                              </span>
                            </td>
                            <td className="p-4 text-gray-300">{mule.stage}</td>
                            <td className="p-4 font-mono text-gray-300">{mule.volume}</td>
                            <td className="p-4 text-right">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMule(mule);
                                }}
                                className="bg-[#EF6820] hover:bg-orange-600 text-white font-medium px-3 py-1 rounded transition-colors"
                              >
                                Investigate
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right panel: Details */}
                <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-5 space-y-6">
                  <div className="border-b border-[#1E293B] pb-4">
                    <span className="text-xs text-gray-400 font-mono">{selectedMule.id}</span>
                    <h3 className="text-lg font-bold text-gray-100 mt-0.5">{selectedMule.name}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0E1322] border border-[#1E293B] p-3 rounded-lg">
                      <span className="text-gray-400 text-xs block">Risk Score</span>
                      <span className="text-xl font-bold font-mono text-red-500">{selectedMule.score}</span>
                    </div>
                    <div className="bg-[#0E1322] border border-[#1E293B] p-3 rounded-lg">
                      <span className="text-gray-400 text-xs block">Activity Pattern</span>
                      <span className="text-sm font-semibold text-gray-200 mt-1 block">{selectedMule.frequency}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Copilot Assessment</h4>
                    <div className="bg-[#1F2937]/30 border border-[#1E293B] p-4 rounded-lg text-xs leading-relaxed text-gray-300 space-y-3">
                      <p>
                        <strong>Description:</strong> Identified high pass-through transaction pattern. Accounts received large sum of funds from multiple third-party accounts, which was immediately routed to 3 high-risk cashout hubs.
                      </p>
                      <div className="flex items-center space-x-2 text-yellow-400 font-medium">
                        <Layers className="h-4 w-4" />
                        <span>Shadow Feature Count: {selectedMule.shadowFlags} triggered</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <button className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded text-xs transition-colors">
                      Freeze Account
                    </button>
                    <button className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium py-2 rounded text-xs transition-colors border border-gray-700">
                      Report to FIU-IND
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BEHAVIORAL DNA */}
          {activeTab === 'dna' && (
            <div className="space-y-6">
              <div className="bg-[#111827] border border-[#1E293B] p-6 rounded-xl space-y-4">
                <h2 className="text-lg font-bold text-gray-200 flex items-center space-x-2">
                  <Cpu className="h-5 w-5 text-[#EF6820]" />
                  <span>Behavioral DNA Refinement & Shadow Mapping</span>
                </h2>
                <p className="text-sm text-gray-300 max-w-3xl">
                  MuleRadar models missing data as a positive fraud indicator (e.g., absence of standard credit-debit cycles). Before cleaning, the platform generates <strong>Shadow Columns</strong> to capture structural missingness.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#111827] border border-[#1E293B] p-5 rounded-xl space-y-3">
                  <h3 className="font-semibold text-sm text-gray-200">Shadow Feature Weight</h3>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>F3043 (64% missingness)</span>
                        <span className="font-mono text-orange-400">Weight: 0.36</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className="bg-orange-500 h-2 rounded-full" style={{ width: '36%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>F2582 (37% missingness)</span>
                        <span className="font-mono text-orange-400">Weight: 0.63</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className="bg-orange-500 h-2 rounded-full" style={{ width: '63%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>F2678 (28% missingness)</span>
                        <span className="font-mono text-orange-400">Weight: 0.72</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className="bg-orange-500 h-2 rounded-full" style={{ width: '72%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#111827] border border-[#1E293B] p-5 rounded-xl space-y-3">
                  <h3 className="font-semibold text-sm text-gray-200">Encoding Mechanics</h3>
                  <ul className="text-xs text-gray-300 space-y-2 list-disc list-inside">
                    <li><strong className="text-orange-400">Ordinal:</strong> F3889 (Tenure) encoded by risk level (L7D &gt; L31D &gt; G365D).</li>
                    <li><strong className="text-orange-400">Target Encoding:</strong> Account type (F3886) mapped directly to risk rates.</li>
                    <li><strong className="text-orange-400">Winsorization:</strong> Right-skewed features winsorized at 99th percentile.</li>
                  </ul>
                </div>

                <div className="bg-[#111827] border border-[#1E293B] p-5 rounded-xl space-y-3">
                  <h3 className="font-semibold text-sm text-gray-200">Refinement Quality Score</h3>
                  <div className="flex flex-col items-center justify-center p-4 border border-dashed border-[#1E293B] rounded-lg">
                    <span className="text-4xl font-extrabold text-green-400 font-mono">98.4%</span>
                    <span className="text-xs text-gray-400 mt-2">Ready for downstream ML</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GNN RING ANALYSIS */}
          {activeTab === 'graph' && (
            <div className="space-y-6">
              <div className="bg-[#111827] border border-[#1E293B] p-6 rounded-xl space-y-4">
                <h2 className="text-lg font-bold text-gray-200 flex items-center space-x-2">
                  <Network className="h-5 w-5 text-[#EF6820]" />
                  <span>GNN-based Mule Ring Detection</span>
                </h2>
                <p className="text-sm text-gray-300 max-w-3xl">
                  Traditional models evaluate accounts as isolated silos. MuleRadar uses Graph Neural Networks (GNNs) to trace relationship links, identifying circular laundering paths and layering structures.
                </p>
              </div>

              {/* Graphical representation simulation */}
              <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-8 h-96 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,104,32,0.05),transparent_60%)]"></div>
                
                {/* Mock Graph Layout Nodes */}
                <div className="relative z-10 flex-1 flex items-center justify-center">
                  <div className="relative w-80 h-64 border border-[#24304F]/60 rounded-full flex items-center justify-center">
                    {/* Center node */}
                    <div className="bg-red-600 text-white rounded-full p-4 shadow-xl z-20 border border-red-400 font-bold text-xs flex flex-col items-center">
                      <ShieldAlert className="h-4 w-4 mb-0.5" />
                      Mule Ring #4
                    </div>
                    {/* Surrounding Nodes */}
                    <div className="absolute top-0 bg-gray-800 border border-[#1E293B] rounded-lg px-3 py-1 text-xs text-gray-300">
                      ACC-8291 (Preparation)
                    </div>
                    <div className="absolute right-0 bg-gray-800 border border-[#1E293B] rounded-lg px-3 py-1 text-xs text-gray-300">
                      ACC-1082 (Layering)
                    </div>
                    <div className="absolute bottom-0 bg-gray-800 border border-[#1E293B] rounded-lg px-3 py-1 text-xs text-gray-300">
                      ACC-6612 (Cash-Out)
                    </div>
                    <div className="absolute left-0 bg-gray-800 border border-[#1E293B] rounded-lg px-3 py-1 text-xs text-gray-300">
                      ACC-9904 (Fund Reception)
                    </div>
                  </div>
                </div>

                <div className="relative z-10 bg-[#0E1322] border border-[#1E293B] p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-ping"></div>
                    <span className="font-semibold text-red-400">Layering Loop Confirmed:</span>
                    <span className="text-gray-300">Circular fund movement detected between 4 entities in under 12 minutes.</span>
                  </div>
                  <button className="bg-[#EF6820] hover:bg-orange-600 text-white px-4 py-1.5 rounded transition-all font-semibold">
                    Export Graph Schema
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AI COPILOT */}
          {activeTab === 'copilot' && (
            <div className="space-y-6">
              <div className="bg-[#111827] border border-[#1E293B] p-6 rounded-xl space-y-4">
                <h2 className="text-lg font-bold text-gray-200 flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-[#EF6820]" />
                  <span>AI Copilot & Explainable AI (SHAP Reasoning)</span>
                </h2>
                <p className="text-sm text-gray-300 max-w-3xl">
                  MuleRadar uses SHAP-based feature attribution to explain the machine learning models. This builds trust with regulators and speeds up suspicious transaction reporting (SAR).
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Explainable UI block */}
                <div className="bg-[#111827] border border-[#1E293B] p-5 rounded-xl space-y-4">
                  <h3 className="font-semibold text-sm text-gray-200">SHAP Feature Attribution</h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between text-gray-400 mb-1">
                        <span>Pass Through Ratio (&gt; 0.92)</span>
                        <span className="font-mono text-red-400">+182 SHAP</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className="bg-red-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-gray-400 mb-1">
                        <span>Shadow Column Missingness (F3043)</span>
                        <span className="font-mono text-red-400">+124 SHAP</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className="bg-red-500 h-2 rounded-full" style={{ width: '65%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-gray-400 mb-1">
                        <span>Multi-hop Network Breadth</span>
                        <span className="font-mono text-red-400">+94 SHAP</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className="bg-red-500 h-2 rounded-full" style={{ width: '48%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-gray-400 mb-1">
                        <span>Account Tenure (L7D)</span>
                        <span className="font-mono text-red-400">+82 SHAP</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className="bg-red-500 h-2 rounded-full" style={{ width: '40%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Copilot SAR generator */}
                <div className="bg-[#111827] border border-[#1E293B] p-5 rounded-xl space-y-4">
                  <h3 className="font-semibold text-sm text-gray-200 flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-orange-400" />
                    <span>Auto-Generated SAR Summary</span>
                  </h3>
                  <div className="bg-[#0E1322] border border-[#1E293B] p-4 rounded-lg text-xs leading-relaxed text-gray-300 font-mono space-y-2">
                    <p><strong>SUBJECT:</strong> Suspicious Mule Account Activity Detected (Risk: {selectedMule.score})</p>
                    <p><strong>ENTITY:</strong> {selectedMule.name} ({selectedMule.id})</p>
                    <p><strong>REASON FOR FILING:</strong> Account flagged during behavioral pass-through analysis. Inflow-outflow ratio reached {selectedMule.volume} within a period of 2 hours, with an average frequency of {selectedMule.frequency}. A high target-encoded risk rank was flagged, and {selectedMule.shadowFlags} missing shadow variables confirmed high data anomaly weights.</p>
                  </div>
                  <button className="w-full bg-[#EF6820] hover:bg-orange-600 text-white font-medium py-2 rounded text-xs transition-colors">
                    Approve and Send to FIU-IND
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1E293B] bg-[#0E1322] px-6 py-4 flex items-center justify-between text-xs text-gray-500">
        <div>© 2026 MuleRadar Systems. Team Orange. All rights reserved.</div>
        <div className="flex items-center space-x-4">
          <span className="hover:text-gray-400 cursor-pointer">Security Policy</span>
          <span className="hover:text-gray-400 cursor-pointer">BOI Guidelines</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
