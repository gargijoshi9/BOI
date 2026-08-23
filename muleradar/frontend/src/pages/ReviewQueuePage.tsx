import React, { useEffect, useState, useCallback } from 'react';
import PageShell from '../components/PageShell';
import { 
  fetchReviewQueue, 
  resolveReview, 
  ReviewQueueItem, 
  ReviewDecisionRequest 
} from '../api/client';
import { AlertTriangle, CheckCircle, ShieldAlert, Clock, User, FileText, RefreshCw } from 'lucide-react';

export const ReviewQueuePage: React.FC = () => {
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Resolution Modal State
  const [selectedItem, setSelectedItem] = useState<ReviewQueueItem | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Memoized fetch function to satisfy ESLint and prevent re-renders
  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchReviewQueue();
      setQueue(data.items);
    } catch (err) {
      console.error(err);
      setError('Failed to load review queue. Ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleResolve = async (decision: ReviewDecisionRequest['decision']) => {
    if (!selectedItem || !reviewerName.trim()) return;
    
    setSubmitting(true);
    try {
      await resolveReview(selectedItem.account_id, {
        decision,
        reviewer_name: reviewerName,
        note
      });
      // Remove the adjudicated account from the local queue state immediately
      setQueue(prev => prev.filter(item => item.account_id !== selectedItem.account_id));
      setSelectedItem(null);
      setNote('');
    } catch (err) {
      console.error(err);
      alert('Failed to record decision. Check console for details.');
    } finally {
      setSubmitting(false);
    }
  };

  const getReasonLabel = (reason?: string) => {
    if (reason === 'borderline_confidence') return 'Borderline Probability';
    if (reason === 'anomaly_override') return 'Distribution Anomaly';
    return reason || 'Manual Escalation';
  };

  return (
    <PageShell>
      <div className="flex flex-1 flex-col gap-6 overflow-hidden p-6 relative">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">
              Human Review Queue
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {queue.length} account{queue.length === 1 ? '' : 's'} require manual adjudication
            </p>
          </div>
          <button 
            onClick={loadQueue}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 text-cyan-400 rounded-lg hover:bg-slate-700 transition shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Queue
          </button>
        </div>

        {/* Queue Table */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#141820] border border-slate-800/80 rounded-xl">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-cyan-400">
              Loading pending reviews...
            </div>
          ) : error ? (
            <div className="flex flex-1 items-center justify-center text-rose-400">
              {error}
            </div>
          ) : queue.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-slate-500 flex-col gap-4">
              <CheckCircle className="w-16 h-16 text-emerald-500/40" />
              <div className="text-center">
                <p className="text-lg font-medium text-slate-300">The review queue is empty.</p>
                <p className="text-sm mt-1">All processed accounts have been auto-resolved.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-auto h-full">
              <table className="w-full text-left text-sm whitespace-nowrap relative">
                <thead className="bg-[#1C212B] text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4">Account ID</th>
                    <th className="px-6 py-4">Risk Score</th>
                    <th className="px-6 py-4">Escalation Reason</th>
                    <th className="px-6 py-4">Time Queued</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {queue.map((item) => (
                    <tr key={item.account_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-cyan-400">{item.account_id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-200">{item.risk_score}</span>
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                            item.risk_level.toUpperCase() === 'CRITICAL' || item.risk_level.toUpperCase() === 'HIGH' 
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/50' 
                              : 'bg-slate-800/50 text-slate-400 border-slate-600'
                          }`}>
                            {item.risk_level}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded text-xs font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {getReasonLabel(item.review_reason)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-600" />
                          {new Date(item.queued_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="px-4 py-1.5 bg-indigo-500/10 text-indigo-400 font-medium tracking-wide border border-indigo-500/30 rounded-lg hover:bg-indigo-500/20 transition shadow-sm"
                        >
                          Adjudicate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Resolution Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#141820] border border-slate-700 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col animate-slide-up">
            
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#1C212B]">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                Adjudicate Account {selectedItem.account_id}
              </h2>
              <button 
                onClick={() => {
                  setSelectedItem(null);
                  setNote('');
                }}
                className="text-slate-500 hover:text-slate-300 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              
              {/* Context Summary Box */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-2">
                <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">System Flag</p>
                <p className="text-sm text-slate-200">
                  Model confidence is borderline (Score: <strong className="text-cyan-400">{selectedItem.risk_score}</strong>). 
                  Reason: <strong className="text-amber-400">{getReasonLabel(selectedItem.review_reason)}</strong>.
                </p>
              </div>

              {/* Investigator Meta Fields */}
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    <User className="w-3.5 h-3.5" /> Investigator Name
                  </label>
                  <input 
                    type="text" 
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="e.g., Jane Doe"
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition shadow-inner"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    <FileText className="w-3.5 h-3.5" /> Audit Trail Notes
                  </label>
                  <textarea 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Rationale for overriding or confirming model confidence..."
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition shadow-inner"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800 grid grid-cols-3 gap-3">
                <button 
                  disabled={submitting || !reviewerName.trim()}
                  onClick={() => handleResolve('clear')}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <CheckCircle className="w-5 h-5 mb-1.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Clear Risk</span>
                </button>
                
                <button 
                  disabled={submitting || !reviewerName.trim()}
                  onClick={() => handleResolve('escalate')}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <AlertTriangle className="w-5 h-5 mb-1.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Escalate</span>
                </button>

                <button 
                  disabled={submitting || !reviewerName.trim()}
                  onClick={() => handleResolve('confirm_mule')}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ShieldAlert className="w-5 h-5 mb-1.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Confirm Mule</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
};

export default ReviewQueuePage;