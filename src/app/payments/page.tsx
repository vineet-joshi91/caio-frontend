"use client";

import Script from "next/script";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "(missing)";

type Me = { email: string; is_admin: boolean; is_paid: boolean };

function getToken(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch {}
  try { return localStorage.getItem("token"); } catch {}
  return null;
}

async function fetchWithDetail(input: RequestInfo, init?: RequestInit) {
  try {
    const res = await fetch(input, init);
    const text = await res.text();
    return { ok: res.ok, status: res.status, statusText: res.statusText, text };
  } catch (e: any) {
    return { ok: false, status: 0, statusText: "NETWORK", text: e?.message || "Failed to fetch" };
  }
}

export default function PaymentsPage() {
  const token = useMemo(getToken, []);
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      if (!token) return; // handled by UI branch below
      if (API_BASE === "(missing)") { setErr("NEXT_PUBLIC_API_BASE is missing."); return; }
      const r = await fetchWithDetail(`${API_BASE}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { setErr(`/api/profile ${r.status} ${r.statusText} :: ${r.text}`); return; }
      try {
        const j = JSON.parse(r.text);
        setMe({ email: j.email, is_admin: !!j.is_admin, is_paid: !!j.is_paid });
      } catch { setErr("Invalid JSON from /api/profile"); }
    })();
  }, [token]);

  // Not logged in
  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="bg-white/10 p-6 rounded-xl text-center">
          <h1 className="text-2xl mb-2">Upgrade your CAIO plan</h1>
          <p className="opacity-80 mb-4">You’re not logged in.</p>
          <Link href="/signup" className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500">Go to Login</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 bg-black text-white">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="bg-white/10 p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl">Upgrade your CAIO plan</h1>
            <Link href="/dashboard" className="text-sm underline text-blue-300">Back to dashboard</Link>
          </div>
          {me ? (
            <p className="opacity-80 mt-1">
              Logged in as <b>{me.email}</b> • {me.is_paid ? "Pro" : "Demo"}
            </p>
          ) : (
            <p className="text-red-300 mt-1">{err || "Loading..."}</p>
          )}
        </header>

        <UpgradeCard token={token} />
      </div>
    </main>
  );
}

function UpgradeCard({ token }: { token: string | null }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function upgrade(plan: "pro" | "premium" = "pro") {
    try {
      if (!token) { setMsg("No token — please log in again."); return; }
      if (API_BASE === "(missing)") { setMsg("NEXT_PUBLIC_API_BASE is missing."); return; }
      setBusy(true); setMsg("");

      // 1) get Razorpay public config
      const cfg = await fetchWithDetail(`${API_BASE}/api/payments/config`);
      if (!cfg.ok) throw new Error(`/api/payments/config ${cfg.status} ${cfg.statusText} :: ${cfg.text}`);
      const { key_id, currency } = JSON.parse(cfg.text);

      // 2) create order for this user
      const ord = await fetchWithDetail(`${API_BASE}/api/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });
      if (!ord.ok) throw new Error(`/api/payments/create-order ${ord.status} ${ord.statusText} :: ${ord.text}`);
      const { order_id, amount, email } = JSON.parse(ord.text);

      // 3) open Razorpay Checkout
      // @ts-ignore
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) { setMsg("Razorpay SDK not loaded."); return; }

      const options = {
        key: key_id,
        amount, currency,
        name: "CAIO",
        description: plan === "premium" ? "Premium plan" : "Pro plan",
        order_id,
        prefill: { email },
        theme: { color: "#2563eb" },
        handler: function () {
          setMsg("Payment completed. Please wait 10–20 sec for activation, then refresh the dashboard.");
        },
        modal: { ondismiss: function () { setMsg("Checkout closed."); } }
      };

      const rzp = new Razorpay(options);
      rzp.open();
    } catch (e: any) {
      setMsg(e?.message || "Upgrade failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white/10 p-6 rounded-xl space-y-4">
      <h2 className="text-xl">Choose your plan</h2>
      <div className="flex items-center gap-3">
        <button
          onClick={() => upgrade("pro")}
          disabled={busy}
          className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50"
        >
          {busy ? "Processing…" : "Upgrade – Pro"}
        </button>
        <button
          onClick={() => upgrade("premium")}
          disabled={busy}
          className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
        >
          {busy ? "Processing…" : "Upgrade – Premium"}
        </button>
      </div>
      {msg ? <div className="text-sm opacity-80">{msg}</div> : null}
      <p className="text-xs opacity-60">API: {API_BASE}</p>
    </section>
  );
}
