import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("Invalid username or password");
        setLoading(false);
        return;
      }
      const data = await res.json();
      localStorage.setItem("muleradar_token", data.token);
      localStorage.setItem("muleradar_user", JSON.stringify(data));
      navigate("/dashboard");
    } catch {
      setError("Connection failed — is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 mb-4">
            <span className="text-2xl">📡</span>
          </div>
          <h1 className="text-2xl font-bold text-white">MuleRadar</h1>
          <p className="text-slate-400 text-sm mt-1">AML Risk Intelligence Console</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="analyst"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="mt-6 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <p className="text-xs text-slate-400 text-center">
            Demo credentials: <code className="text-indigo-400">analyst</code> / <code className="text-indigo-400">mule123</code>
          </p>
        </div>

        <p className="text-xs text-slate-500 text-center mt-4">
          Bank of India — AML Division • Hackathon Demo
        </p>
      </div>
    </div>
  );
}
