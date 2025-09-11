"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

const TIMEOUT_MS = 60000;
const WARMUP_MAX_MS = 60000;

export default function LoginPage() {
  const r = useRouter();

  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState<string | null>(null);
  const [debug, setDebug] = useState<{ url: string; status?: string; body?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [warmMsg, setWarmMsg] = useState("Checking server…");

  function saveToken(token: string) {
    document.cookie = `token=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; SameSite=Lax`;
    try {
      localStorage.setItem("token", token);
      localStorage.setItem("access_token", token);
    } catch {}
  }
  function clearAuthClient() {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("access_token");
    } catch {}
    document.cookie = "token=; Path=/; Max-Age=0; SameSite=Lax";
  }
  async function backendLogout() {
    // best-effort: try both, ignore failures (handles HttpOnly cookie)
    try { await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "include" }); } catch {}
    try { await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" }); } catch {}
  }

  async function fetchWithTimeout(url: string, init?: RequestInit, ms = TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try { return await fetch(url, { ...init, signal: controller.signal }); }
    finally { clearTimeout(timer); }
  }

  async function warmBackend() {
    setWarmMsg("Warming app…");
    try { await fetchWithTimeout(`${API_BASE}/api/health`, { cache: "no-store" }, 8000); } catch {}
    setWarmMsg("Warming database…");
    let delay = 800, waited = 0;
    while (waited < WARMUP_MAX_MS) {
      try {
        const rdy = await fetchWithTimeout(`${API_BASE}/api/ready`, { cache: "no-store" }, 8000);
        if (rdy.ok) {
          const j = await rdy.json().catch(() => ({}));
          if (j?.ok || j?.ready) { setWarmMsg("Server is ready"); return; }
        }
      } catch {}
      await new Promise(res => setTimeout(res, delay));
      waited += delay;
      delay = Math.min(Math.floor(delay * 1.6), 4000);
    }
    setWarmMsg("Server took long to wake. You can still try logging in.");
  }

  useEffect(() => { warmBackend(); }, []);

  async function postLogin(): Promise<{ ok: boolean; data?: any; status?: string; text?: string }> {
    const url = `${API_BASE}/api/login`;
    const body = new URLSearchParams({ username: form.email.trim(), password: form.password }).toString();
    try {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
        credentials: "include",
      }, TIMEOUT_MS);
      const text = await res.text();
      let data: any = {}; try { data = text ? JSON.parse(text) : {}; } catch {}
      setDebug({ url, status: `${res.status} ${res.statusText}`, body: text || "(empty)" });
      return { ok: res.ok, data, status: String(res.status), text };
    } catch (e: any) {
      setDebug({ url, status: "timeout/network", body: String(e?.message || e) });
      return { ok: false, status: "timeout" };
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setDebug(null); setBusy(true);
    try {
      let resp = await postLogin();
      for (let i = 0; i < 2 && (!resp.ok && resp.status === "timeout"); i++) {
        await new Promise(res => setTimeout(res, 1200 * (i + 1)));
        try { await fetchWithTimeout(`${API_BASE}/api/ready`, { cache: "no-store" }, 8000); } catch {}
        resp = await postLogin();
      }
      if (!resp.ok) {
        const msg = resp.status === "timeout"
          ? "Server is waking up. Please try again."
          : resp?.data?.detail || `Login failed (${resp.status})`;
        throw new Error(msg);
      }
      if (resp.data?.access_token) saveToken(resp.data.access_token);
      // Let dashboard decide where to send you based on tier
      r.replace("/dashboard");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function goToSignup() {
    // CRITICAL: clear server and client auth so signup is anonymous
    await backendLogout();
    clearAuthClient();
    window.location.href = "/signup";
  }

  return (
    <main style={wrap}>
      <form onSubmit={submit} style={card}>
        <h1 style={{ margin: "0 0 10px" }}>Log in</h1>

        <div style={{ opacity: 0.7, fontSize: 12 }}><b>API_BASE:</b> {API_BASE}</div>
        <div style={{ opacity: 0.8, fontSize: 12, margin: "6px 0 10px" }}>{warmMsg}</div>

        <label style={label}>
          Work email
          <input required type="email" value={form.email}
                 onChange={(e) => setForm({ ...form, email: e.target.value })}
                 style={input} placeholder="you@company.com" />
        </label>

        <label style={label}>
          Password
          <input required type="password" value={form.password}
                 onChange={(e) => setForm({ ...form, password: e.target.value })}
                 style={input} placeholder="••••••••" />
        </label>

        {err ? <div style={errBox}>{err}</div> : null}

        {debug ? (
          <details style={blk} open>
            <summary>Last request</summary>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
              <div><b>URL:</b> {debug.url}</div>
              <div><b>Status:</b> {debug.status || "(n/a)"}</div>
              <div><b>Body:</b></div>
              <pre style={pre}>{debug.body}</pre>
            </div>
          </details>
        ) : null}

        <button disabled={busy} type="submit" style={btnPrimary}>
          {busy ? "Signing in..." : "Log in"}
        </button>

        <div style={{ marginTop: 10, fontSize: 13 }}>
          New here?{" "}
          <button type="button" onClick={goToSignup}
                  style={{ color: "#93c5fd", background: "none", border: 0, padding: 0, cursor: "pointer" }}>
            Create an account
          </button>
        </div>
      </form>
    </main>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100vh", display: "grid", placeItems: "center",
  background: "#0b0f1a", color: "#e5e7eb"
};
const card: React.CSSProperties = {
  width: 360, padding: 20, border: "1px solid #243044", borderRadius: 12, background: "#0e1320"
};
const label: React.CSSProperties = { display: "block", marginTop: 10 };
const input: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #2b3650",
  background: "#0f172a", color: "#e5e7eb"
};
const btnPrimary: React.CSSProperties = {
  width: "100%", marginTop: 14, padding: "10px 12px", borderRadius: 10, border: "0",
  background: "linear-gradient(90deg,#8B5CF6,#22D3EE,#22C55E)", color: "#fff", fontWeight: 800, cursor: "pointer"
};
const errBox: React.CSSProperties = {
  marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "#3a1f1f",
  border: "1px solid #5a3535", color: "#fecaca", fontSize: 13
};
const pre: React.CSSProperties = {
  whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#0d1220",
  border: "1px solid #23304a", borderRadius: 8, padding: 10, fontSize: 12
};
const blk: React.CSSProperties = { marginTop: 10 };
