"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

type Currency = "INR" | "USD";
type Plan = "pro" | "pro_plus" | "premium";

type PublicConfig = {
  pricing?: {
    PRO?: { USD: number; INR: number };
    PRO_PLUS?: { USD: number; INR: number };
    PREMIUM?: { USD: number; INR: number };
  };
  pay?: { defaultCurrency?: Currency };
};

function readToken(): string {
  try {
    return (
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      decodeURIComponent(document.cookie.match(/(?:^|;\s*)token=([^;]+)/)?.[1] || "")
    );
  } catch {
    return "";
  }
}

export default function PaymentsPage() {
  const token = useMemo(readToken, []);
  const [me, setMe] = useState<{ email?: string } | null>(null);
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>("USD");

  // Load profile (just for the “Logged in as” line) + public pricing/config
  useEffect(() => {
    (async () => {
      try {
        const [p, c] = await Promise.all([
          token
            ? fetch(`${API_BASE}/api/profile`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
              }).then((r) => r.ok ? r.json() : null)
            : Promise.resolve(null),
          fetch(`${API_BASE}/api/public-config`, { cache: "no-store" }).then((r) => r.ok ? r.json() : {}),
        ]);
        setMe(p);
        setCfg(c);

        // pick currency
        const def = (c?.pay?.defaultCurrency as Currency) || (Intl.DateTimeFormat().resolvedOptions().timeZone?.includes("Asia") ? "INR" : "USD");
        setCurrency(def);
      } catch (e: any) {
        setErr(e?.message || "Could not load payment config.");
      }
    })();
  }, [token]);

  const pricing = {
    PRO:      { USD: 25, INR: 1999 },
    PRO_PLUS: { USD: 49, INR: 3999 },
    PREMIUM:  { USD: 99, INR: 7999 },
    ...(cfg?.pricing || {}),
  };

  async function startCheckout(plan: Plan) {
    setErr(null);
    setBusy(plan);

    try {
      // Choose gateway by currency
      if (currency === "INR") {
        // Razorpay order init
        const res = await fetch(`${API_BASE}/api/pay/razorpay/init`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ plan, currency }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.detail || body?.message || "Payment init failed.");
        // If you load Razorpay Checkout.js on page, you can open modal here.
        // For now, just fallback to redirect if your backend returns a hosted page.
        if (body.checkout_url) {
          window.location.assign(body.checkout_url);
          return;
        }
        if (body.order_id && body.key_id) {
          // Example minimal inline checkout:
          // @ts-ignore
          const rp = new (window as any).Razorpay({
            key: body.key_id,
            amount: body.amount,
            currency: body.currency,
            name: "CAIO",
            description: `CAIO ${plan.toUpperCase()} subscription`,
            order_id: body.order_id,
            handler: function () {
              window.location.assign("/dashboard");
            },
            prefill: { email: me?.email || "" },
          });
          rp.open();
          return;
        }
        // If neither URL nor order, show an error.
        throw new Error("Unexpected Razorpay response.");
      } else {
        // USD → Stripe
        const res = await fetch(`${API_BASE}/api/pay/stripe/create-checkout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ plan, currency }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || body?.detail || "Payment init failed.");
        if (!body.checkout_url) throw new Error("Missing checkout URL.");
        window.location.assign(body.checkout_url);
      }
    } catch (e: any) {
      setErr(e?.message || "Could not start checkout.");
    } finally {
      setBusy(null);
    }
  }

  const pill = (label: string) => (
    <span className="px-2 py-0.5 rounded-full text-xs border border-zinc-700 bg-zinc-900/70">{label}</span>
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Upgrade your CAIO plan</h1>
          <Link href="/dashboard" className="px-3 py-1.5 rounded-md border border-zinc-700 bg-zinc-900/70 hover:bg-zinc-800">
            ← Back to dashboard
          </Link>
        </header>

        <div className="mb-4 opacity-80">
          Logged in as <b>{me?.email || "—"}</b>
        </div>

        {/* currency toggle */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm opacity-80">Currency:</span>
          <button
            className={`px-2.5 py-1 rounded-md border ${currency === "USD" ? "bg-zinc-800" : "bg-zinc-900/60"} border-zinc-700`}
            onClick={() => setCurrency("USD")}
          >
            USD $
          </button>
          <button
            className={`px-2.5 py-1 rounded-md border ${currency === "INR" ? "bg-zinc-800" : "bg-zinc-900/60"} border-zinc-700`}
            onClick={() => setCurrency("INR")}
          >
            INR ₹
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* PRO */}
          <PlanCard
            title="Pro"
            price={
              currency === "INR"
                ? `₹${pricing.PRO.INR.toLocaleString("en-IN")}/mo`
                : `$${pricing.PRO.USD}/mo`
            }
            features={[
              "Full analysis engine",
              "Priority processing",
              "Email support",
            ]}
            ctas={[
              {
                label: busy === "pro" ? "Starting…" : "Start subscription",
                onClick: () => startCheckout("pro"),
                busy: busy === "pro",
                primary: true,
              },
              { label: "What’s included?", onClick: () => {}, secondary: true },
            ]}
            badge={pill("Individual")}
          />

          {/* PRO+ */}
          <PlanCard
            title="Pro+"
            price={
              currency === "INR"
                ? `₹${pricing.PRO_PLUS.INR.toLocaleString("en-IN")}/mo`
                : `$${pricing.PRO_PLUS.USD}/mo`
            }
            features={[
              "Chat mode (limited daily messages)",
              "Higher upload limits",
              "Priority support",
            ]}
            ctas={[
              {
                label: busy === "pro_plus" ? "Starting…" : "Start subscription",
                onClick: () => startCheckout("pro_plus"),
                busy: busy === "pro_plus",
                primary: true,
              },
              { label: "Compare plans", onClick: () => {}, secondary: true },
            ]}
            badge={pill("Best value")}
          />

          {/* PREMIUM */}
          <PlanCard
            title="Premium"
            highlight
            price={
              currency === "INR"
                ? `₹${pricing.PREMIUM.INR.toLocaleString("en-IN")}/mo`
                : `$${pricing.PREMIUM.USD}/mo`
            }
            features={[
              "Chat mode (full)",
              "Highest limits",
              "SLA & onboarding",
            ]}
            ctas={[
              {
                label: busy === "premium" ? "Starting…" : "Start subscription",
                onClick: () => startCheckout("premium"),
                busy: busy === "premium",
                primary: true,
              },
              { label: "Talk to sales", onClick: () => window.open("mailto:support@yourdomain.com", "_blank"), secondary: true },
            ]}
            badge={pill("Teams / Power users")}
          />
        </div>

        {/* error box */}
        {err && (
          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            <h3 className="font-semibold mb-1">We hit a snag</h3>
            <div className="text-sm">{err}</div>
          </div>
        )}

        <div className="mt-6 text-sm opacity-70">
          Payment issues? <a className="underline" href="mailto:support@yourdomain.com">Need support</a>
        </div>
      </div>
    </main>
  );
}

/* ---------------- Small presentational component ---------------- */

function PlanCard({
  title,
  price,
  features,
  ctas,
  badge,
  highlight = false,
}: {
  title: string;
  price: string;
  features: string[];
  ctas: { label: string; onClick: () => void; busy?: boolean; primary?: boolean; secondary?: boolean }[];
  badge?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${highlight ? "border-emerald-400/30 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900/60"}`}
      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.35)" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">{title}</h3>
        {badge}
      </div>
      <div className="mt-2 text-2xl font-bold">{price}</div>
      <ul className="mt-3 space-y-2 text-sm opacity-95">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-500"></span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-col gap-2">
        {ctas.map((c) => (
          <button
            key={c.label}
            onClick={c.onClick}
            disabled={!!c.busy}
            className={`px-3 py-2 rounded-lg border ${
              c.primary
                ? "bg-blue-600 hover:bg-blue-500 border-blue-500 text-white disabled:opacity-60"
                : "bg-zinc-950/50 hover:bg-zinc-900/70 border-zinc-700"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
