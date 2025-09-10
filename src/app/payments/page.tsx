"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

/* ---------------- Types for backend config ---------------- */
type Fiat = "USD" | "INR";
type PlanKey = "pro" | "pro_plus" | "premium";

type Money = { amount_major: number; symbol: string };
type PlanPricing = Record<Fiat, Money>;

type PayConfig = {
  provider: "razorpay" | "stripe" | "disabled";
  defaultCurrency: Fiat;
  currencies: Fiat[];
  plans: Record<PlanKey, PlanPricing>;
};

type PublicConfig = {
  pay?: PayConfig;
};

type CheckoutResp =
  | { url: string }
  | { error: string; detail?: string };

/* ---------------- Helpers ---------------- */
function readToken(): string {
  try {
    return (
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      (document.cookie.match(/(?:^|;\s*)token=([^;]+)/)?.[1]
        ? decodeURIComponent(document.cookie.match(/(?:^|;\s*)token=([^;]+)/)![1])
        : "")
    );
  } catch {
    return "";
  }
}

function guessCurrency(): Fiat {
  try {
    // Simple heuristic: treat Asia/* as INR, else USD
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    return tz.includes("Asia") ? "INR" : "USD";
  } catch {
    return "USD";
  }
}

function fmt(m?: Money): string {
  if (!m) return "";
  // e.g. "₹1,999" or "$25"
  try {
    const n = new Intl.NumberFormat(m.symbol === "₹" ? "en-IN" : "en-US").format(m.amount_major);
    return `${m.symbol}${n}`;
  } catch {
    return `${m.symbol}${m.amount_major}`;
  }
}

/* ---------------- Page ---------------- */
export default function PaymentsPage() {
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [currency, setCurrency] = useState<Fiat>("USD");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const token = useMemo(readToken, []);

  useEffect(() => {
    (async () => {
      setErr(null);
      try {
        const res = await fetch(`${API_BASE}/api/pay/config`, { cache: "no-store" });
        const j = (await res.json()) as PublicConfig;
        setCfg(j);

        // pick currency: backend default -> tz guess
        const def =
          (j?.pay?.defaultCurrency as Fiat | undefined) ?? guessCurrency();
        setCurrency(def);
      } catch (e: any) {
        setErr(e?.message || "Could not load payment configuration.");
      }
    })();
  }, []);

  const pay = cfg?.pay;
  const currencies: Fiat[] = pay?.currencies?.length ? pay.currencies : ["USD", "INR"];
  const provider = pay?.provider ?? "disabled";

  async function start(plan: PlanKey) {
    if (provider === "disabled") {
      setErr("Payments are currently unavailable. Please try again later.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${API_BASE}/api/pay/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ plan, currency }),
      });
      const body = (await res.json()) as CheckoutResp;

      if (!res.ok || (body as any).error) {
        setErr((body as any).detail || (body as any).error || `Checkout failed (HTTP ${res.status}).`);
        return;
      }

      if ("url" in body && body.url) {
        window.location.assign(body.url);
        return;
      }

      setErr("Unexpected checkout response. Please contact support.");
    } catch (e: any) {
      setErr(e?.message || "Network error while creating checkout.");
    } finally {
      setBusy(false);
    }
  }

  function Price({ plan }: { plan: PlanKey }) {
    const m = pay?.plans?.[plan]?.[currency];
    return <span className="text-2xl font-bold">{fmt(m)} <span className="text-sm opacity-70">/ month</span></span>;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Upgrade your CAIO plan</h1>
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm"
          >
            ← Back to dashboard
          </Link>
        </div>

        {/* Currency picker */}
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-80">Currency</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Fiat)}
            className="px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* Pro */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pro</h2>
            </div>
            <Price plan="pro" />
            <ul className="text-sm space-y-1 opacity-90">
              <li>• Full analysis engine</li>
              <li>• Priority processing</li>
              <li>• Email support</li>
            </ul>
            <button
              onClick={() => start("pro")}
              disabled={busy}
              className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
            >
              {busy ? "Please wait…" : "Start subscription"}
            </button>
          </div>

          {/* Pro+ */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pro+</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-200">
                Limited chat included
              </span>
            </div>
            <Price plan="pro_plus" />
            <ul className="text-sm space-y-1 opacity-90">
              <li>• Everything in Pro</li>
              <li>• Chat mode (limited)</li>
              <li>• Higher file limits</li>
            </ul>
            <button
              onClick={() => start("pro_plus")}
              disabled={busy}
              className="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
            >
              {busy ? "Please wait…" : "Start subscription"}
            </button>
          </div>

          {/* Premium */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Premium</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-200">
                Full chat + SLA
              </span>
            </div>
            <Price plan="premium" />
            <ul className="text-sm space-y-1 opacity-90">
              <li>• Shared credits & seats</li>
              <li>• Custom integrations</li>
              <li>• SLAs & onboarding</li>
            </ul>
            <button
              onClick={() => start("premium")}
              disabled={busy}
              className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
            >
              {busy ? "Please wait…" : "Start subscription"}
            </button>
          </div>
        </div>

        {/* Error panel */}
        {err && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            <div className="font-semibold mb-1">We hit a snag</div>
            <div className="text-sm">{err}</div>
          </div>
        )}

        {/* Help */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="text-sm opacity-85">
            Payment issues? <a href="mailto:support@caio.ai" className="underline">Need support</a>
          </div>
        </div>
      </div>
    </main>
  );
}
