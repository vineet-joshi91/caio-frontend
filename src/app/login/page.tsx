"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

const TIMEOUT_MS = 30000; // 30s for Render cold starts

export default function LoginPage() {
  const r = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState<string | null>(null);
  const [debug, setDebug] = useState<{ url: string; status?: string; body?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function saveToken(token: string) {
    document.cookie = `token=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; SameSite=Lax`;
    localStorage.setItem("token", token);
  }

  function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    // @ts-ignore
    p.signal = ac.signal;
    // @ts-ignore
    return new Promise((resolve, reject) => {
      fetch; // keep TS happy if it inlines
    }).catch(() => {}) as any;
  }

  async function fetchWithTimeout(url: string, init?: RequestInit, ms = TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  async function warmUp() {
    try {
      await fetchWithTimeout(`${API_BASE}/api/health`, { cache: "no-store" }, 10000);
    } catch {
      // ignore; this is just a warmup
    }
  }

  async function postLogin(): Promise<{ ok: boolean; data?: any; status?: string; text?: string }> {
    const url = `${API_BASE}/api/login`;
    const body = new URLSearchParams({ username: form.email, password: form.password }).toString();
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
          cache: "no-store",
        },
        TIMEOUT_MS
      );
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch {}
      setDebug({ url, status: `${res.status} ${res.statusText}`, body: text || "(empty)" });
      return { ok: res.ok, data, status: `${res.status}`, text };
    } catch (e: any) {
      setDebug({ url, status: "timeout/network", body: String(e?.message || e) });
      return { ok: false, status: "timeout" };
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setDebug(null);
    setBusy(true);
    try {
      // 1) Warm up Render (cold start)
      await warmUp();

      // 2) First attempt
      let resp = await postLogin();

      // 3) If timeout (likely cold start), wait 2s and retry once
      if (!resp.ok && resp.status === "timeout") {
        await new Promise((res) => setTimeout(res, 2000));
        resp = await postLogin();
      }

      if (!resp.ok) {
        const msg =
          resp.status === "timeout"
            ? "Server is waking up. Please try again."
            : resp?.data?.detail || `Login failed (${resp.status})`;
        throw new Error(msg);
      }

      if (resp.data?.access_token) saveToken(resp.data.access_token);
      r.replace("/dashboard");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={wrap}>
      <form onSubmit={submit} style={card}>
        <h1 style={{ margin: "0 0 10px" }}>Log in</h1>

        <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>
          <b>API_BASE:</b> {API_BASE}
        </div>

        <label style={label}>
          Work email
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={input}
            placeholder="you@company.com"
          />
        </label>

        <label style={label}>
          Password
          <input
            required
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            style={input}
            placeholder="••••••••"
          />
        </label>

        {err ? <div style={errBox}>{err}</div> : null}
        {debug ? (
          <details style={blk} open>
            <summary>Last request</summary>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
              <div>
                <b>URL:</b> {debug.url}
              </div>
              <div>
                <b>Status:</b> {debug.status || "(n/a)"}
              </div>
              <div>
                <b>Body:</b>
              </div>
              <pre style={pre}>{debug.body}</pre>
            </div>
          </details>
        ) : null}

        <button disabled={busy} type="submit" style={btnPrimary}>
          {busy ? "Signing in..." : "Log in"}
        </button>

        <div style={{ marginTop: 10, fontSize: 13 }}>
          New here? <a href="/signup" style={{ color: "#93c5fd" }}>Create an account</a>
        </div>
      </form>
    </main>
  );
}

const wrap: React.CSSProperties = { minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0f1a", color: "#e5e7eb" };
const card: React.CSSProperties = { width: 360, padding: 20, border: "1px solid #243044", borderRadius: 12, background: "#0e1320" };
const label: React.CSSProperties = { display: "block", marginTop: 10 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #2b3650", background: "#0f172a", color: "#e5e7eb" };
const btnPrimary: React.CSSProperties = { width: "100%", marginTop: 14, padding: "10px 12px", borderRadius: 10, border: "0", background: "linear-gradient(90deg,#8B5CF6,#22D3EE,#22C55E)", color: "#fff", fontWeight: 800, cursor: "pointer" };
const errBox: React.CSSProperties = { marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "#3a1f1f", border: "1px solid #5a3535", color: "#fecaca", fontSize: 13 };
const pre: React.CSSProperties = { whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#0d1220", border: "1px solid #23304a", borderRadius: 8, padding: 10, fontSize: 12 };
const blk: React.CSSProperties = { marginTop: 10 };
