"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";

/* ------------------------------ Config ------------------------------ */

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

type Currency = "USD" | "INR";

/** What we *expect* from /api/public-config — intentionally loose */
type PublicConfig = Partial<{
  pricing: any;
  plans: any;
  region: string;
  currency: Currency;
  flags: any;
  copy: any;
}>;

/** Our normalized table the UI will actually use */
type PriceTable = {
  pro: Record<Currency, number>;
  pro_plus: Record<Currency, number>;
  premium: Record<Currency, number>;
};

/* ------------------------------ Helpers ------------------------------ */

function getToken(): string {
  try {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("token") || localStorage.getItem("access_token") || "";
  } catch {
    return "";
  }
}

/**
 * Normalize the many shapes we have seen the public-config return.
 * This accepts either a `pricing` object or a `plans` object.
 * Fallback to our current product prices if a key is missing.
 */
function normalizePricing(cfg?: PublicConfig): PriceTable {
  const fallback: PriceTable = {
    pro: { USD: 25, INR: 1999 },
    pro_plus: { USD: 49, INR: 3999 },
    premium: { USD: 99, INR: 7999 },
  };

  const anyPricing = cfg?.pricing ?? {};
  const p1 = anyPricing?.plans ?? anyPricing;

  const fromPerPlan =
    p1?.pro && p1?.pro_plus && p1?.premium
      ? {
          pro: {
            USD: Number(p1?.pro?.USD ?? p1?.pro?.price_usd ?? p1?.pro?.priceUSD ?? p1?.pro?.price ?? 25),
            INR: Number(p1?.pro?.INR ?? p1?.pro?.price_inr ?? p1?.pro?.priceINR ?? p1?.pro?.price ?? 1999),
          },
          pro_plus: {
            USD: Number(
              p1?.pro_plus?.USD ?? p1?.pro_plus?.price_usd ?? p1?.pro_plus?.priceUSD ?? p1?.pro_plus?.price ?? 49,
            ),
            INR: Number(
              p1?.pro_plus?.INR ?? p1?.pro_plus?.price_inr ?? p1?.pro_plus?.priceINR ?? p1?.pro_plus?.price ?? 3999,
            ),
          },
          premium: {
            USD: Number(p1?.premium?.USD ?? p1?.premium?.price_usd ?? p1?.premium?.priceUSD ?? p1?.premium?.price ?? 99),
            INR: Number(
              p1?.premium?.INR ?? p1?.premium?.price_inr ?? p1?.premium?.priceINR ?? p1?.premium?.price ?? 7999,
            ),
          },
        }
      : null;

  if (fromPerPlan) return fromPerPlan as PriceTable;

  const p2 = cfg?.plans ?? {};
  const fromPlansCurrencyResolved =
    typeof p2?.pro?.price === "number" &&
    typeof p2?.pro_plus?.price === "number" &&
    typeof p2?.premium?.price === "number"
      ? {
          pro: { USD: Number(p2.pro.price), INR: Number(p2.pro.price) },
          pro_plus: { USD: Number(p2.pro_plus.price), INR: Number(p2.pro_plus.price) },
          premium: { USD: Number(p2.premium.price), INR: Number(p2.premium.price) },
        }
      : null;

  if (fromPlansCurrencyResolved) return fromPlansCurrencyResolved as PriceTable;

  return fallback;
}

/* ------------------------------ Page ------------------------------ */

export default function PaymentsPage() {
  const token = useMemo(getToken, []);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(true);
  const [checkoutPlan, setCheckoutPlan] = useState<null | "pro" | "pro_plus" | "premium">(null);
  const [err, setErr] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [prices, setPrices] = useState<PriceTable>({
    pro: { USD: 25, INR: 1999 },
    pro_plus: { USD: 49, INR: 3999 },
    premium: { USD: 99, INR: 7999 },
  });

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/public-config`, { cache: "no-store" });
        const raw = await r.text();
        let cfg: PublicConfig = {};
        try {
          cfg = raw ? (JSON.parse(raw) as PublicConfig) : {};
        } catch {
          cfg = {};
        }

        setPrices(normalizePricing(cfg));

        // Auto-pick currency: server-specified currency wins, else region heuristic.
        const c1 = (cfg?.currency as Currency | undefined) || null;
        const region = (cfg?.region || "").toUpperCase();
        const c2: Currency = region === "IN" || region === "INDIA" ? "INR" : "USD";
        setCurrency((c1 || c2) as Currency);
      } catch (e: any) {
        console.error("/api/public-config failed:", e?.message || e);
      } finally {
        setLoadingConfig(false);
      }
    })();
  }, []);

  const startCheckout = useCallback(
    async (plan: "pro" | "pro_plus" | "premium") => {
      setErr(null);
      setCheckoutPlan(plan);
      try {
        const res = await fetch(`${API_BASE}/api/payments/subscription/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ plan, currency }),
          credentials: "include",
        });

        const bodyText = await res.text();
        let j: any = {};
        try {
          j = bodyText ? JSON.parse(bodyText) : {};
        } catch {
          j = {};
        }

        if (res.status === 405) {
          throw new Error(
            "Method Not Allowed — is /api/payments/subscription/create (POST) implemented and mounted under /api?",
          );
        }
        if (res.status === 401) {
          throw new Error("You must be signed in to start a subscription.");
        }
        if (!res.ok || !(j?.short_url || j?.url)) {
          throw new Error(j?.detail || j?.message || bodyText || `Checkout failed (HTTP ${res.status}).`);
        }
        window.location.href = (j.short_url || j.url) as string;
      } catch (e: any) {
        setErr(e?.message || "Could not start checkout.");
      } finally {
        setCheckoutPlan(null);
      }
    },
    [token, currency],
  );

  const price = {
    pro: prices.pro[currency],
    pro_plus: prices.pro_plus[currency],
    premium: prices.premium[currency],
  };

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-8" data-test-id="payments-page">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Upgrade your CAIO plan</h1>
        <Link className="text-sm text-blue-300 underline hover:text-blue-200" href="/dashboard">
          ← Back to dashboard
        </Link>
      </div>

      {/* Billing currency banner */}
      <div className="mb-6 rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-sm">
        Billing currency: <b>{currency}</b> (auto-detected)
        <span className="ml-2 opacity-60">• API: {API_BASE}</span>
        {loadingConfig && <span className="ml-2 animate-pulse opacity-60">• Loading config…</span>}
      </div>

      {/* Error banner */}
      {err && (
        <div className="mb-6 rounded-lg border border-red-700 bg-red-900/30 p-4 text-red-100" role="alert">
          <div className="font-semibold">We hit a snag</div>
          <div className="text-sm opacity-90">{err}</div>
        </div>
      )}

      {/* Plans */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <PlanCard
          title="Pro"
          price={`${currency === "INR" ? "₹" : "$"}${price.pro}/mo`}
          features={["Full analysis engine (OpenRouter)", "Higher limits than Demo", "Email support"]}
          cta="Start subscription"
          onClick={() => startCheckout("pro")}
          button="bg-blue-600 hover:bg-blue-500"
          loading={checkoutPlan === "pro"}
          dataAttrs={{ "data-plan": "pro" }}
        />

        <PlanCard
          title="Pro+"
          price={`${currency === "INR" ? "₹" : "$"}${price.pro_plus}/mo`}
          features={["Chat mode (limited context)", "Bigger daily caps", "Priority processing"]}
          cta="Start Pro+"
          onClick={() => startCheckout("pro_plus")}
          button="bg-fuchsia-600 hover:bg-fuchsia-500"
          loading={checkoutPlan === "pro_plus"}
          highlight={false}
          dataAttrs={{ "data-plan": "pro_plus" }}
        />

        <PlanCard
          title="Premium"
          price={`${currency === "INR" ? "₹" : "$"}${price.premium}/mo`}
          features={["Premium Chat with file uploads", "Highest limits", "SLA & onboarding"]}
          cta="Start Premium"
          onClick={() => startCheckout("premium")}
          button="bg-emerald-600 hover:bg-emerald-500"
          loading={checkoutPlan === "premium"}
          highlight
          dataAttrs={{ "data-plan": "premium" }}
        />
      </div>

      <div className="mt-8">
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4 text-sm opacity-85">
          Payment questions?{" "}
          <a className="underline text-blue-300 hover:text-blue-200" href="mailto:hello@caio.ai">
            Contact support
          </a>
          .
        </div>
      </div>
    </main>
  );
}

/* ------------------------------ UI bits ------------------------------ */

function PlanCard(props: {
  title: string;
  price: string;
  features: string[];
  cta: string;
  onClick: () => void;
  button: string;
  highlight?: boolean;
  loading?: boolean;
  dataAttrs?: Record<string, string>;
}) {
  const { title, price, features, cta, onClick, button, highlight, loading, dataAttrs } = props;
  return (
    <div
      className={`rounded-2xl border p-6 shadow-sm transition-colors ${
        highlight ? "border-emerald-400/40 bg-emerald-400/5" : "border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/60"
      }`}
      {...(dataAttrs || {})}
    >
      <div className="mb-1 text-sm uppercase tracking-wide opacity-70">{title}</div>
      <div className="mb-4 text-3xl font-bold">{price}</div>
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm opacity-90">
        {features.map((b, i) => (
          <li key={i}>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        disabled={!!loading}
        className={`mt-4 w-full rounded-lg px-4 py-2 text-white ${button} disabled:opacity-60`}
        aria-busy={loading ? "true" : "false"}
        aria-disabled={loading ? "true" : "false"}
      >
        {loading ? "Loading…" : cta}
      </button>
    </div>
  );
}
