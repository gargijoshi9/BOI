import { useEffect, useState } from "react";
import PageShell from "../components/PageShell";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface ActionRecord {
  account_id: string;
  action: string;
  note: string;
  analyst: string;
  timestamp: number;
  risk_score_at_action?: number;
}

export default function AuditTrailPage() {
  const [trail, setTrail] = useState<ActionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTrail = async () => {
    try {
      const res = await fetch(`${API}/api/v1/audit-trail`);
      if (res.ok) setTrail(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadTrail(); }, []);

  const actionIcon = (action: string) => {
    switch (action) {
      case "freeze": return "🔒";
      case "unfreeze": return "🔓";
      case "escalate": return "⬆️";
      case "dismiss": return "✅";
      default: return "📝";
    }
  };

  const actionColor = (action: string) => {
    switch (action) {
      case "freeze": return "text-red-400";
      case "unfreeze": return "text-green-400";
      case "escalate": return "text-orange-400";
      case "dismiss": return "text-slate-400";
      default: return "text-slate-300";
    }
  };

  return (
    <PageShell>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">📋 Audit Trail</h1>
            <p className="text-slate-400 text-sm mt-1">
              Compliance log of all investigator actions — who acted, when, on which account.
            </p>
          </div>
          <button
            onClick={loadTrail}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-slate-400">Loading audit trail...</div>
        ) : trail.length === 0 ? (
          <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-8 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-slate-400">No actions recorded yet.</p>
            <p className="text-slate-500 text-sm mt-1">
              Actions appear here when you Freeze, Escalate, or Dismiss accounts from the Accounts page.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/50">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Time</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Action</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Account</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Analyst</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Risk Score</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {trail.map((r, i) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 text-slate-300 text-xs">
                      {new Date(r.timestamp * 1000).toLocaleString()}
                    </td>
                    <td className={`py-2.5 px-4 font-medium ${actionColor(r.action)}`}>
                      {actionIcon(r.action)} {r.action.toUpperCase()}
                    </td>
                    <td className="py-2.5 px-4 text-white font-mono">{r.account_id}</td>
                    <td className="py-2.5 px-4 text-slate-300">{r.analyst}</td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {r.risk_score_at_action ?? "—"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 max-w-xs truncate">{r.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
