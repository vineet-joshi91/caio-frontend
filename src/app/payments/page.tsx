"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export default function PaymentsPage() {
  const [me, setMe] = useState<{ email: string } | null>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function getToken(): string | null {
    try {
      const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : localStorage.getItem("token");
    } catch {
      return null;
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }

    (async () => {
      setErr(null);
      try {
        const pr = await fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const pj = await pr.json().catch(() => ({}));
        if (!pr.ok) throw new Error(pj?.detail || `Profile ${pr.status}`);
        setMe({ email: pj.email });

        const cr = await fetch(`${API_BASE}/api/payments/config`, { cache: "no-store" });
        const cj = await cr.json().catch(() => ({}));
        if (!cr.ok) throw new Error(cj?.detail || `Config ${cr.status}`);
        setCfg(cj);
      } catch (e: any) {
        setErr(String(e.message || e));
      }
    })();
  }, []);

  async function upgradePro() {
    const token = getToken();
    if (!token) { window.location.href = "/login"; return; }
    setErr(null); setBusy(true);

    try {
      const r = await fetch(`${API_BASE}/api/payments/create-order`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.detail?.error?.description || j?.detail || `HTTP ${r.status}`);

      const opts = {
        key: j.key_id,
        amount: j.amount,
        currency: j.currency,
        name: "CAIO",
        description: "CAIO Pro subscription",
        order_id: j.order_id,
        prefill: { email: j.email },
        notes: { plan: "pro" },
        theme: { color: "#0ea5e9" },
        handler: function () {
          window.location.href = "/dashboard?upgraded=1";
        },
        modal: { ondismiss: function () {} },
      };

      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.body.appendChild(s);
        });
      }

      const rz = new window.Razorpay(opts);
      rz.open();

    } catch (e: any) {
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={wrap}>
      <div style={card}>
        {/* Header with back link */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
          <h2 style={{margin:0}}>Upgrade your CAIO plan</h2>
          <Link href="/dashboard" style={backLink} aria-label="Back to dashboard">
            ← Back to dashboard
          </Link>
        </div>

        <div style={{opacity:.75, marginBottom:12}}>
          Logged in as <b>{me?.email || "…"}</b>
          {cfg?.mode ? <> • <span>{cfg.mode === "test" ? "Demo" : "Live"}</span></> : null}
        </div>

        <div style={grid}>
          <div style={planBox}>
            <h3>Upgrade — Pro</h3>
            <ul style={ul}>
              <li>Full analysis engine (OpenAI)</li>
              <li>Priority processing</li>
              <li>Email support</li>
            </ul>
            <button onClick={upgradePro} disabled={busy} style={btnPrimary}>
              {busy ? "Starting checkout..." : "Upgrade — Pro"}
            </button>
            {cfg ? (
              <div style={{opacity:.7, fontSize:12, marginTop:6}}>
                {cfg.currency} {cfg.amount_major} / {cfg.period}
              </div>
            ) : null}
          </div>

          <div style={planBoxSecondary}>
            <h3>Upgrade — Premium</h3>
            <ul style={ul}>
              <li>Shared credits & seats</li>
              <li>Custom integrations</li>
              <li>SLAs & onboarding</li>
            </ul>
            <Link href="/contact" style={btnSecondary}>Contact us</Link>
          </div>
        </div>

        {err ? (
          <div style={errBox}>
            <div><b>We hit a snag</b></div>
            <pre style={pre}>{err}</pre>
            <div style={{marginTop:8}}>
              Need help? <Link href="/contact">Contact support</Link> or email <a href="mailto:vineetpjoshi.71@gmail.com">vineetpjoshi.71@gmail.com</a>
            </div>
          </div>
        ) : null}

        <div style={helpBox}>
          Having trouble with payments? <Link href="/contact">Need support</Link>
        </div>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = { minHeight: "100vh", background:"#0b0f1a", color:"#e5e7eb", padding:24, display:"grid", placeItems:"start center" };
const card: React.CSSProperties = { width:"min(100%,900px)", background:"#0e1320", border:"1px solid #243044", borderRadius:14, padding:20 };
const grid: React.CSSProperties = { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 };
const planBox: React.CSSProperties = { border:"1px solid #1f2a44", borderRadius:12, padding:16, background:"#0f172a" };
const planBoxSecondary: React.CSSProperties = { border:"1px solid #2a1845", borderRadius:12, padding:16, background:"#1a1030" };
const ul: React.CSSProperties = { margin:"10px 0 14px 18px" };
const btnPrimary: React.CSSProperties = { display:"inline-block", padding:"10px 14px", borderRadius:10, border:"0", background:"#059669", color:"#fff", fontWeight:700, cursor:"pointer" };
const btnSecondary: React.CSSProperties = { display:"inline-block", padding:"10px 14px", borderRadius:10, border:"0", background:"#a21caf", color:"#fff", fontWeight:700, textDecoration:"none" };
const errBox: React.CSSProperties = { marginTop:16, padding:12, borderRadius:10, border:"1px solid #5a3535", background:"#331b1b" };
const helpBox: React.CSSProperties = { marginTop:14, padding:10, borderRadius:10, border:"1px solid #244055", background:"#0c1526", fontSize:14 };
const pre: React.CSSProperties = { whiteSpace: "pre-wrap", wordBreak: "break-word", background:"#0d1220", border:"1px solid #23304a", borderRadius:8, padding:10, fontSize:12 };
const backLink: React.CSSProperties = { fontSize:14, color:"#93c5fd", textDecoration:"none", border:"1px solid #243044", padding:"6px 10px", borderRadius:8, background:"#0f172a" };
