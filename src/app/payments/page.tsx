"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

type Me = { email: string; is_paid?: boolean };
type Cfg = { mode: "razorpay"; currency: "INR"; amount_major: number; amount: number; interval: string; key_id: string };

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function getToken(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : localStorage.getItem("token");
  } catch { return null; }
}

async function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(s);
  });
}

export default function PaymentsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setErr(null);
      const t = getToken();
      if (!t) { window.location.href = "/login"; return; }
      try {
        const pr = await fetch(`${API_BASE}/api/profile`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
        const pj = await pr.json().catch(()=>({}));
        if (!pr.ok) throw new Error(pj?.detail || `Profile ${pr.status}`);
        setMe({ email: pj.email, is_paid: !!pj.is_paid });

        const cr = await fetch(`${API_BASE}/api/payments/subscription-config`, { cache: "no-store" });
        const cj = await cr.json().catch(()=>({}));
        if (!cr.ok) throw new Error(cj?.detail || `Config ${cr.status}`);
        setCfg(cj as Cfg);
      } catch(e:any) { setErr(String(e.message||e)); }
    })();
  }, []);

  async function startSubscription() {
    const t = getToken(); if (!t) { window.location.href="/login"; return; }
    if (!cfg) return;

    setBusy(true); setErr(null); setMsg(null);
    try {
      // 1) Create subscription on backend
      const r = await fetch(`${API_BASE}/api/payments/subscribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      });
      const j = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(j?.detail || `HTTP ${r.status}`);
      const { subscription_id, key_id } = j as { subscription_id: string; key_id: string };

      // Persist for cancel
      try { localStorage.setItem("rzp_sub_id", subscription_id); } catch {}

      // 2) Load SDK and open checkout
      await loadRazorpayScript();
      const rp = new window.Razorpay({
        key: key_id || cfg.key_id,
        subscription_id,
        name: "CAIO Pro",
        description: `${cfg.currency} ${cfg.amount_major} / ${cfg.interval}`,
        theme: { color: "#0ea5e9" },
        prefill: { email: me?.email || "" },
        modal: {
          ondismiss: () => setMsg("Checkout closed."),
        },
        handler: async (resp: any) => {
          try {
            // resp = { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
            const vr = await fetch(`${API_BASE}/api/payments/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
              body: JSON.stringify(resp),
            });
            const vj = await vr.json().catch(()=>({}));
            if (!vr.ok) throw new Error(vj?.detail || `Verify ${vr.status}`);
            setMsg("Subscription active! 🎉");
            setMe(m => m ? { ...m, is_paid: true } : m);
          } catch (e:any) {
            setErr(e?.message || "Verification failed");
          }
        },
      });
      rp.open();
    } catch(e:any) {
      setErr(String(e.message||e));
    } finally {
      setBusy(false);
    }
  }

  async function cancelNow() {
    const t = getToken(); if (!t) { window.location.href="/login"; return; }
    const sub_id = (()=>{ try { return localStorage.getItem("rzp_sub_id") || ""; } catch { return ""; } })();
    if (!sub_id) { setErr("No subscription id found. Try from the device you used to subscribe."); return; }

    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await fetch(`${API_BASE}/api/payments/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ subscription_id: sub_id }),
      });
      const j = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(j?.detail || `Cancel ${r.status}`);
      setMsg("Subscription cancelled. You’re on Free now.");
      setMe(m => m ? { ...m, is_paid: false } : m);
    } catch(e:any) {
      setErr(String(e.message||e));
    } finally {
      setBusy(false);
    }
  }

  const alreadyPro = !!me?.is_paid;

  return (
    <main style={wrap}>
      <div style={card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h2 style={{margin:0}}>Upgrade your CAIO plan</h2>
          <Link href="/dashboard" style={backLink}>← Back to dashboard</Link>
        </div>
        <div style={{opacity:.75, marginBottom:12}}>Logged in as <b>{me?.email || "…"}</b></div>

        <div style={grid}>
          <div style={planBox}>
            <h3>Pro — Subscription</h3>
            <ul style={ul}>
              <li>Full analysis engine (OpenAI)</li>
              <li>Priority processing</li>
              <li>Email support</li>
            </ul>

            {!alreadyPro ? (
              <button onClick={startSubscription} disabled={busy || !cfg} style={btnPrimary}>
                {busy ? "Starting…" : "Start subscription"}
              </button>
            ) : (
              <button onClick={cancelNow} disabled={busy} style={{...btnSecondary, background:"#ef4444"}}>
                Cancel subscription (immediate)
              </button>
            )}

            {cfg ? (
              <div style={{opacity:.7, fontSize:12, marginTop:6}}>
                {cfg.currency} {cfg.amount_major} / {cfg.interval} · via Razorpay
              </div>
            ) : null}
          </div>

          <div style={planBoxSecondary}>
            <h3>Premium</h3>
            <ul style={ul}>
              <li>Shared credits & seats</li>
              <li>Custom integrations</li>
              <li>SLAs & onboarding</li>
            </ul>
            <Link href="/contact" style={btnSecondary}>Contact us</Link>
          </div>
        </div>

        {err ? <div style={errBox}><b>We hit a snag</b><pre style={pre}>{err}</pre></div> : null}
        {msg ? <div style={okBox}>{msg}</div> : null}

        <div style={helpBox}>Payment issues? <Link href="/contact">Need support</Link></div>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = { minHeight:"100vh", background:"#0b0f1a", color:"#e5e7eb", padding:24, display:"grid", placeItems:"start center" };
const card: React.CSSProperties = { width:"min(100%,900px)", background:"#0e1320", border:"1px solid #243044", borderRadius:14, padding:20 };
const grid: React.CSSProperties = { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 };
const planBox: React.CSSProperties = { border:"1px solid #1f2a44", borderRadius:12, padding:16, background:"#0f172a" };
const planBoxSecondary: React.CSSProperties = { border:"1px solid #2a1845", borderRadius:12, padding:16, background:"#1a1030" };
const ul: React.CSSProperties = { margin:"10px 0 14px 18px" };
const btnPrimary: React.CSSProperties = { display:"inline-block", padding:"10px 14px", borderRadius:10, border:"0", background:"#059669", color:"#fff", fontWeight:700 };
const btnSecondary: React.CSSProperties = { display:"inline-block", padding:"10px 14px", border:"0", color:"#fff", fontWeight:700, textDecoration:"none" };
const backLink: React.CSSProperties = { fontSize:14, color:"#93c5fd", textDecoration:"none", border:"1px solid #243044", padding:"6px 10px", borderRadius:8, background:"#0f172a" };
const errBox: React.CSSProperties = { marginTop:16, padding:12, borderRadius:10, border:"1px solid #5a3535", background:"#331b1b" };
const okBox: React.CSSProperties = { marginTop:12, padding:10, borderRadius:10, border:"1px solid #2b4f2a", background:"#163018" };
const helpBox: React.CSSProperties = { marginTop:14, padding:10, borderRadius:10, border:"1px solid #244055", background:"#0c1526", fontSize:14 };
const pre: React.CSSProperties = { whiteSpace:"pre-wrap", wordBreak:"break-word", background:"#0d1220", border:"1px solid #23304a", borderRadius:8, padding:10, fontSize:12 };
