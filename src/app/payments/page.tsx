"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

type Me = { email: string; is_paid?: boolean };
type SubConfig = {
  mode: "razorpay";
  key_id: string | null;
  has_secret: boolean;
  interval: string;                // e.g. "every 1 monthly"
  defaultCurrency: string;         // "INR" or "USD"
  pricing: Record<string, { amount_major: number; symbol?: string }>;
};

declare global {
  interface Window {
    Razorpay?: any;
  }
}

/** Read token from cookie or localStorage; support BOTH access_token and token */
function getToken(): string | null {
  try {
    const cookie = document.cookie || "";
    const pick = (name: string) =>
      cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1];

    const c1 = pick("access_token");
    const c2 = pick("token");
    if (c1) return decodeURIComponent(c1);
    if (c2) return decodeURIComponent(c2);

    const l1 = localStorage.getItem("access_token");
    const l2 = localStorage.getItem("token");
    if (l1) return l1;
    if (l2) return l2;

    return null;
  } catch {
    return null;
  }
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
  const [cfg, setCfg] = useState<SubConfig | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentPrice = (() => {
    if (!cfg) return null;
    const entry = cfg.pricing?.[cfg.defaultCurrency];
    if (!entry || typeof entry.amount_major !== "number") return null;
    return { currency: cfg.defaultCurrency, amount_major: entry.amount_major };
  })();

  useEffect(() => {
    (async () => {
      setErr(null);
      const t = getToken();
      if (!t) {
        setErr("Missing auth token. Please log in again.");
        return;
      }
      try {
        // Profile
        const pr = await fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: `Bearer ${t}` },
          cache: "no-store",
        });
        const pj = await pr.json().catch(() => ({}));
        if (!pr.ok) throw new Error(pj?.detail || `Profile ${pr.status}`);
        setMe({ email: pj.email, is_paid: !!pj.is_paid });

        // Subscription config (key, currency, pricing map)
        const cr = await fetch(`${API_BASE}/api/payments/subscription-config`, {
          cache: "no-store",
        });
        const cj = (await cr.json().catch(() => ({}))) as SubConfig;
        if (!cr.ok) throw new Error((cj as any)?.detail || `Config ${cr.status}`);
        setCfg(cj);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, []);

  async function startSubscription() {
    console.log("[payments] startSubscription clicked");
    const t = getToken();
    if (!t) { setErr("No token found. Please log in again."); return; }
    if (!cfg) { setErr("Payment config not loaded yet. Try again."); return; }
    if (!cfg.key_id) { setErr("Razorpay key missing on server (key_id)."); return; }

    setBusy(true); setErr(null); setMsg(null);

    try {
      // Create subscription on backend (correct route)
      const body = {
        currency: cfg.defaultCurrency,
        notes: { email: me?.email || "" },
      };
      const res = await fetch(`${API_BASE}/api/payments/subscription/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(body),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.detail || `Subscribe ${res.status}`);

      const { subscription_id, currency, amount_major } = j as {
        subscription_id: string;
        currency: string;
        amount_major: number;
      };

      try { localStorage.setItem("rzp_sub_id", subscription_id); } catch {}

      // Open Razorpay checkout
      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error("Razorpay SDK blocked/failed to load.");

      const rp = new window.Razorpay({
        key: cfg.key_id,
        subscription_id,
        name: "CAIO Pro",
        description: `${currency} ${amount_major} / ${cfg.interval}`,
        theme: { color: "#0ea5e9" },
        prefill: { email: me?.email || "" },
        modal: { ondismiss: () => setMsg("Checkout closed.") },
        handler: async (resp: any) => {
          // Try a verify endpoint if/when we add it; otherwise, rely on Razorpay webhook.
          try {
            const vr = await fetch(`${API_BASE}/api/payments/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
              body: JSON.stringify(resp),
            });
            if (vr.ok) {
              setMsg("Subscription active! 🎉");
              setMe(m => m ? { ...m, is_paid: true } : m);
            } else {
              setMsg("Payment captured. Your account will upgrade automatically once the webhook confirms.");
            }
          } catch {
            setMsg("Payment captured. Your account will upgrade automatically once the webhook confirms.");
          }
        },
      });

      rp.open();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const alreadyPro = !!me?.is_paid;

  return (
    <main style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Upgrade your CAIO plan</h2>
          <Link href="/dashboard" style={backLink}>← Back to dashboard</Link>
        </div>

        <div style={{ opacity: 0.75, marginBottom: 12 }}>
          Logged in as <b>{me?.email || "…"}</b>
        </div>

        <div style={grid}>
          <div style={planBox}>
            <h3>Pro — Subscription</h3>
            <ul style={ul}>
              <li>Full analysis engine (OpenAI)</li>
              <li>Priority processing</li>
              <li>Email support</li>
            </ul>

            {!alreadyPro ? (
              <button
                onClick={startSubscription}
                disabled={busy || !cfg}
                style={btnPrimary}
                title={!cfg ? "Loading payment config…" : ""}
              >
                {busy ? "Starting…" : "Start subscription"}
              </button>
            ) : (
              // Hidden for now: backend cancel route not implemented yet
              <button disabled style={{ ...btnSecondary, opacity: 0.5 }} title="Cancel will be available soon">
                Cancel subscription
              </button>
            )}

            {currentPrice ? (
              <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
                {currentPrice.currency} {currentPrice.amount_major} / {cfg?.interval} · via Razorpay
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

        {err ? (
          <div style={errBox}>
            <b>We hit a snag</b>
            <pre style={pre}>{err}</pre>
          </div>
        ) : null}

        {msg ? <div style={okBox}>{msg}</div> : null}

        <div style={helpBox}>
          Payment issues? <Link href="/contact">Need support</Link>
        </div>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#0b0f1a", color: "#e5e7eb", padding: 24, display: "grid", placeItems: "start center" };
const card: React.CSSProperties = { width: "min(100%,900px)", background: "#0e1320", border: "1px solid #243044", borderRadius: 14, padding: 20 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };
const planBox: React.CSSProperties = { border: "1px solid #1f2a44", borderRadius: 12, padding: 16, background: "#0f172a" };
const planBoxSecondary: React.CSSProperties = { border: "1px solid #2a1845", borderRadius: 12, padding: 16, background: "#1a1030" };
const ul: React.CSSProperties = { margin: "10px 0 14px 18px" };
const btnPrimary: React.CSSProperties = { display: "inline-block", padding: "10px 14px", borderRadius: 10, border: "0", background: "#059669", color: "#fff", fontWeight: 700 };
const btnSecondary: React.CSSProperties = { display: "inline-block", padding: "10px 14px", border: "0", color: "#fff", fontWeight: 700, textDecoration: "none" };
const backLink: React.CSSProperties = { fontSize: 14, color: "#93c5fd", textDecoration: "none", border: "1px solid #243044", padding: "6px 10px", borderRadius: 8, background: "#0f172a" };
const errBox: React.CSSProperties = { marginTop: 16, padding: 12, borderRadius: 10, border: "1px solid #7f1d1d", background: "#1f0b0b" };
const okBox: React.CSSProperties  = { marginTop: 16, padding: 12, borderRadius: 10, border: "1px solid #14532d", background: "#0b1f14" };
const pre: React.CSSProperties     = { margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", fontSize: 12 };
const helpBox: React.CSSProperties = { marginTop: 16, padding: 12, borderRadius: 10, border: "1px solid #243044", background: "#0f172a" };
