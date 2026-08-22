import { useState, useCallback } from "react";
import PageShell from "../components/PageShell";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface ScoredRow {
  account_id: string;
  risk_score: number;
  risk_level: string;
  kill_chain_stage: string;
}

export default function ValidatePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScoredRow[]>([]);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResults([]);
    setWarnings([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API}/api/v1/validate`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || `Upload failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setResults(data.results || []);
      setWarnings(data.warnings || []);
    } catch {
      setError("Connection failed — is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [file]);

  const riskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "critical": return "text-red-400 bg-red-500/10 border-red-500/30";
      case "high": return "text-orange-400 bg-orange-500/10 border-orange-500/30";
      case "medium": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      default: return "text-green-400 bg-green-500/10 border-green-500/30";
    }
  };

  return (
    <PageShell>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">✅ Validate Dataset</h1>
        <p className="text-slate-400 text-sm mb-6">
          Upload a CSV to score accounts with the trained ensemble model. Results are directly comparable to the dashboard.
        </p>

        {/* Upload Area */}
        <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-6 mb-6">
          <div
            className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500/50 transition-colors"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div>
                <p className="text-white font-medium">{file.name}</p>
                <p className="text-slate-400 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-3xl mb-2">📁</p>
                <p className="text-slate-300">Drag & drop a CSV file or click to browse</p>
                <p className="text-slate-500 text-sm mt-1">Must have same schema as training data</p>
              </div>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="mt-4 w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "Scoring accounts..." : "Run Validation"}
          </button>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4 mb-6">
            <p className="text-amber-400 text-sm font-medium mb-2">⚠️ Schema Warnings</p>
            {warnings.map((w, i) => (
              <p key={i} className="text-amber-300/70 text-xs">{w}</p>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-5">
            <h2 className="text-lg font-semibold text-white mb-4">
              Scored Accounts ({results.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Account ID</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Risk Score</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Risk Level</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Kill Chain Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {results
                    .sort((a, b) => b.risk_score - a.risk_score)
                    .map((r) => (
                      <tr key={r.account_id} className="border-b border-slate-800/50">
                        <td className="py-2 px-3 text-slate-200 font-mono">{r.account_id}</td>
                        <td className="py-2 px-3 text-white font-bold">{r.risk_score}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-xs border ${riskColor(r.risk_level)}`}>
                            {r.risk_level}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-300">{r.kill_chain_stage}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
