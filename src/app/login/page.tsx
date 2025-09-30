"use client";

import { useState } from "react";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim().replace(/\/+$/,"")) ||
  "https://caio-orchestrator.onrender.com";

// Where non-admin users land after login (set in Vercel if you want something else)
const POST_LOGIN_PATH =
  (process.env.NEXT_PUBLIC_POST_LOGIN_PATH && process.env.NEXT_PUBLIC_POST_LOGIN_PATH.trim()) ||
  "/chat"; // ← change to your normal user home

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);

    try {
      // 1) Login
      const r = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // allow backend to set cookie
        body: JSON.stringify({ email, password }),
      });

      if (!r.ok) {
        let msg = `HTTP ${r.status}`;
        try { msg = (await r.json())?.detail || msg; } catch {}
        throw new Error(msg);
      }

      const data = await r.json(); // { access_token }
      const token: string | undefined = data?.access_token;
      if (!token) throw new Error("No token returned");

      // 2) Clear old token, store new token (cookie + localStorage)
      try { localStorage.removeItem("access_token"); } catch {}
      document.cookie = "token=; Path=/; Max-Age=0; SameSite=Lax";

      localStorage.setItem("access_token", token);
      document.cookie = [
        `token=${encodeURIComponent(token)}`,
        "Path=/",
        "Max-Age=2592000", // 30 days
        "SameSite=Lax",
        location.protocol === "https:" ? "Secure" : ""
      ].join("; ");

      // 3) Fetch profile to decide where to go
      const pr = await fetch(`${API_BASE}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        cache: "no-store",
      });
      if (!pr.ok) {
        // If profile fails, default to non-admin path
        window.location.assign(POST_LOGIN_PATH);
        return;
      }
      const profile = await pr.json();
      const isAdmin = !!(profile?.is_admin || profile?.tier === "admin" || profile?.tier === "premium");

      // 4) Route based on role
      window.location.assign(isAdmin ? "/admin" : POST_LOGIN_PATH);
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0b0f1a] text-gray-200 p-6">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Log in</h1>

        {err && (
          <div className="rounded-lg border border-red-700 bg-red-900/30 px-3 py-2 text-sm">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm opacity-80">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[#243044] bg-[#0e1320] px-3 py-2 outline-none"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm opacity-80">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[#243044] bg-[#0e1320] px-3 py-2 outline-none"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-3 py-2 font-medium"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Helpful debug hint */}
        <p className="text-xs opacity-60">
          API: <code>{API_BASE}</code> • Post-login: <code>{POST_LOGIN_PATH}</code>
        </p>
      </div>
    </main>
  );
}
