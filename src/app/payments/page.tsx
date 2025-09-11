"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* ------------------------------ Config ------------------------------ */

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

type Currency = "USD" | "INR";

/** What we *expect* from /api/public-config — kept intentionally loose */
type PublicConfig = Partial<{
  currency: Record<Currency, { symbol: string }>;
  // Flexible pricing shape; we normalize it below
  pricing: any;
  pay: Partial<{ defaultCurrency: Currency }>;
}>;

/* ------------------------------ Utils ------------------------------ */

function getToken(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : localStorage.getItem("token") || localStorage.getItem("access_token");
  } catch {
    return null;
  }
}

function guessCurrencyFromLocale(): Currency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    // Simple heuristic: if user timezone contains "Asia", default to INR
    return /asia/i.test(tz) ? "INR" : "USD";
  } catch {
    return "USD";
  }
}

function fmt(amount: number, currency: Currency) {
  const opts: Intl.NumberFormatOptions = { style: "currency", currency, maximumFractionDigits: 0 };
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", opts).format(amount);
}

/* Normalized pricing shape we’ll use in the UI */
type PriceTable = {
  pro: Record<Currency, number>;
  pro_plus: Record<Currency, number>;
  premium: Record<Currency, number>;
};

/* Take whatever the backend returns and coerce into our PriceTable.
   Fallback to our current product prices if a key is missing. */
function normalizePricing(cfg?: PublicConfig): PriceTable {
  // Current default prices (can be safely changed without breaking the UI)
  const fallback: PriceTable = {
    pro: { USD: 25, INR: 1999 },
    pro_plus: { USD: 49, INR: 3999 },
    premium: { USD: 99, INR: 7999 },
  };

  const anyPricing = cfg?.pricing ?? {};
  // Try a few common shapes:
  //  1) { plans: { pro: { USD: 25, INR: 1999 }, ... } }
  //  2) { pro: { USD: 25, INR: 1999 }, ... }
  //  3) { USD: { pro: 25, pro_plus: 49, premium: 99 }, INR: {...} }
  const p1 = anyPricing?.plans ?? anyPricing;

  const fromPerPlan =
    p1?.pro && p1?.pro_plus && p1?.premium
      ? {
          pro: { USD: Number(p1.pro.USD ?? p1.pro.usd ?? fallback.pro.USD), INR: Number(p1.pro.INR ?? p1.pro.inr ?? fallback.pro.INR) },
          pro_plus: {
            USD: Number(p1.pro_plus.USD ?? p1.pro_plus.usd ?? fallback.pro_plus.USD),
            INR: Number(p1.pro_plus.INR ?? p1.pro_plus.inr ?? fallback.pro_plus.INR),
          },
          premium: {
            USD: Number(p1.premium.USD ?? p1.premium.usd ?? fallback.premium.USD),
            INR: Number(p1.premium.INR ?? p1.premium.inr ?? fallback.premium.INR),
          },
        }
      : null;

  if (fromPerPlan) return fromPerPlan as PriceTable;

  const fromPerCurrency =
    p1?.USD && p1?.INR
      ? {
          pro: { USD: Number(p1.USD.pro ?? fallback.pro.USD), INR: Number(p1.INR.pro ?? fallback.pro.INR) },
          pro_plus: { USD: Number(p1.USD.pro_plus ?? fallback.pro_plus.USD), INR: Number(p1.INR.pro_plus ?? fallback.pro_plus.INR) },
          premium: { USD: Number(p1.USD.premium ?? fallback.premium.USD), INR: Number(p1.INR.premium ?? fallback.premium.INR) },
        }
      : null;

  if (fromPerCurrency) return fromPerCurrency as PriceTable;

  return fallback;
}

/* ------------------------------ Page ------------------------------ */

export default function PaymentsPage() {
  const token = useMemo(getToken, []);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [prices, setPrices] = useState<PriceTable>(() => normalizePricing());

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`${API_BASE}/api/public-config`, { cache: "no-store" });
        // Parse defensively; don’t assume a shape.
        const raw = await r.text();
        let cfg: PublicConfig = {};
        try {
          cfg = raw ? (JSON.parse(raw) as PublicConfig) : {};
        } catch {
          cfg = {};
        }

        setPrices(normalizePricing(cfg));

        // Pick a default currency safely (no more c?.pay on {} blowups)
        const def: Currency =
          (cfg && cfg.pay && (cfg.pay.defaultCurrency as Currency)) || guessCurrencyFromLocale();
        setCurrency(def);
      } catch (e: any) {
        // Still choose a sensible currency even if the call fails
        setCurrency(guessCurrencyFromLocale());
        setErr(e?.message || "Couldn’t load pricing.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function startCheckout(plan: "pro" | "pro_plus" | "premium") {
    setErr(null);
    try {
      const res = await fetch(`${API_BASE}/api/pay/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ plan, currency }),
      });
      const bodyText = await res.text();
      let j: any = {};
      try {
        j = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        j = {};
      }

      if (res.status === 405) {
        // Helpful hint while backend route is being wired
        throw new Error(
          "Method Not Allowed — is /api/pay/create-checkout-session (POST) implemented on the backend and mounted under /api?"
        );
      }
      if (!res.ok || !j?.url) {
        throw new Error(j?.detail || j?.message || bodyText || `Checkout failed (HTTP ${res.status}).`);
      }
      window.location.href = j.url as string;
    } catch (e: any) {
      setErr(e?.message || "Could not start checkout.");
    }
  }

  const sym = currency === "INR" ? "₹" : "$";
  const price = {
    pro: prices.pro[currency],
    pro_plus: prices.pro_plus[currency],
    premium: prices.premium[currency],
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Upgrade your CAIO plan</h1>
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-900"
          >
            ← Back to dashboard
          </Link>
        </div>

        {/* Currency picker (client-side only) */}
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-80">Billing currency:</span>
          <select
            className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-sm"
            value={currency}
            onChange={(e) => setCurrency((e.target.value as Currency) || "USD")}
          >
            <option value="USD">USD (US Dollar)</option>
            <option value="INR">INR (Indian Rupee)</option>
          </select>
        </div>

        {err && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            <div className="font-semibold mb-1">We hit a snag</div>
            <div className="text-sm">{err}</div>
          </div>
        )}

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* Pro */}
          <PlanCard
            title="Pro"
            price={`${fmt(price.pro, currency)}/mo`}
            bullets={[
              "Full analysis engine (OpenRouter)",
              "Higher limits than Demo",
              "Email support",
            ]}
            cta="Start subscription"
            onClick={() => startCheckout("pro")}
            loading={loading}
            accent="sky"
          />

          {/* Pro+ */}
          <PlanCard
            title="Pro+"
            price={`${fmt(price.pro_plus, currency)}/mo`}
            bullets={[
              "Chat mode (limited context)",
              "Bigger daily caps",
              "Priority processing",
            ]}
            cta="Start Pro+"
            onClick={() => startCheckout("pro_plus")}
            loading={loading}
            accent="violet"
          />

          {/* Premium */}
          <PlanCard
            title="Premium"
            price={`${fmt(price.premium, currency)}/mo`}
            bullets={[
              "Premium Chat with file uploads",
              "Highest limits",
              "SLA & onboarding",
            ]}
            cta="Start Premium"
            onClick={() => startCheckout("premium")}
            loading={loading}
            accent="emerald"
            highlight
          />
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm opacity-85">
          Need custom seats or invoicing?{" "}
          <a className="underline text-blue-300 hover:text-blue-200" href="mailto:hello@caio.ai">
            Contact us
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
  bullets: string[];
  cta: string;
  onClick: () => void;
  loading?: boolean;
  accent?: "sky" | "violet" | "emerald";
  highlight?: boolean;
}) {
  const { title, price, bullets, cta, onClick, loading, accent = "sky", highlight = false } = props;

  const ring =
    accent === "emerald"
      ? "ring-emerald-500/30"
      : accent === "violet"
      ? "ring-violet-500/30"
      : "ring-sky-500/30";
  const border =
    accent === "emerald"
      ? "border-emerald-500/30"
      : accent === "violet"
      ? "border-violet-500/30"
      : "border-sky-500/30";
  const button =
    accent === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-500"
      : accent === "violet"
      ? "bg-violet-600 hover:bg-violet-500"
      : "bg-sky-600 hover:bg-sky-500";

  return (
    <div
      className={`rounded-2xl border ${border} bg-zinc-900/60 p-5 shadow-lg ${highlight ? `ring-2 ${ring}` : ""}`}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="text-xl font-bold">{price}</div>
      </div>
      <ul className="mt-3 space-y-2 text-sm opacity-90">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="opacity-60">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        disabled={!!loading}
        className={`mt-4 w-full rounded-lg px-4 py-2 text-white ${button} disabled:opacity-60`}
      >
        {loading ? "Loading…" : cta}
      </button>
    </div>
  );
}