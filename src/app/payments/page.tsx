"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;
const RZP_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

type Me = { email: string; is_admin: boolean; is_paid: boolean };

export default function PaymentsPage() {
  const router = useRouter();
  const token = useMemo(() => getAuthToken(), []);
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [stage, setStage] = useState<"idle"|"checkout"|"processing"|"done">("idle");

  // Load profile & Razorpay script
  useEffect(() => {
    (async () => {
      if (!token) { setBusy(false); return; }
      try {
        setBusy(true);
        const res = await fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Couldn't load your profile.");
        const j = await res.json();
        setMe({ email: j.email, is_admin: !!j.is_admin, is_paid: !!j.is_paid });
      } catch (e: any) {
        setErr(e?.message || "Something went wrong.");
      } finally {
        setBusy(false);
      }
    })();

    // Razorpay script
    if (!document.querySelector(`script[src="${RZP_SCRIPT}"]`)) {
      const s = document.createElement("script");
      s.src = RZP_SCRIPT;
      s.async = true;
      document.head.appendChild(s);
    }
  }, [token]);

  async function createOrder(plan: "pro") {
    setErr(null);
    setStage("checkout");
    try {
      const res = await fetch(`${API_BASE}/api/payments/create-order`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "Unable to start checkout.");
      }
      const j = await res.json(); // { order_id, amount, currency, key_id }
      return j as { order_id: string; amount: number; currency: string; key_id: string };
    } catch (e: any) {
      setStage("idle");
      setErr(e?.message || "Unable to start checkout.");
      throw e;
    }
  }

  function openRazorpay(order: { order_id: string; amount: number; currency: string; key_id: string }) {
    // @ts-ignore - global loaded by script tag
    if (typeof window !== "undefined" && window.Razorpay) {
      // @ts-ignore
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount, // in paise if INR
        currency: order.currency,
        name: "CAIO",
        description: "CAIO Pro subscription",
        order_id: order.order_id,
        prefill: { email: me?.email || "" },
        theme: { color: "#2563EB" }, // blue
        modal: {
          ondismiss: () => setStage("idle"),
        },
        handler: function (_response: any) {
          // Success at client side; real confirmation is via webhook
          setStage("processing");
          // Begin polling /api/profile to see when is_paid flips
          startPollingUntilUpgraded();
        },
      });
      rzp.open();
    } else {
      setErr("Payment module did not load. Please refresh and try again.");
      setStage("idle");
    }
  }

  function startPollingUntilUpgraded() {
    const started = Date.now();
    const iv = setInterval(async () => {
      if (Date.now() - started > 60000) { // 60s timeout
        clearInterval(iv);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const j = await res.json();
        if (j?.is_paid) {
          clearInterval(iv);
          setStage("done");
          router.push("/dashboard");
        }
      } catch {}
    }, 3000);
  }

  async function onClickPro() {
    if (!token) { router.push("/signup"); return; }
    try {
      const order = await createOrder("pro");
      openRazorpay(order);
    } catch { /* errors already shown */ }
  }

  function onClickPremium() {
    setContactOpen(true);
  }

  function mailToPremium() {
    const subject = encodeURIComponent("CAIO Premium – I'd like to upgrade");
    const body = encodeURIComponent(
      `Hi CAIO team,

I'd like to discuss CAIO Premium for my account${me?.email ? ` (${me.email})` : ""}.

Use case / company:
Budget / timeline:
Any questions:

Thanks!`
    );
    window.location.href = `mailto:vineetpjoshi.71@gmail.com?subject=${subject}&body=${body}`;
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-6">
        <div className="bg-zinc-900/70 p-6 rounded-2xl text-center shadow-xl border border-zinc-800">
          <h1 className="text-2xl mb-2">Upgrade your CAIO plan</h1>
          <p className="opacity-80 mb-4">Please log in to continue.</p>
          <Link href="/signup" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500">Go to login</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 bg-zinc-950 text-zinc-100">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Upgrade your CAIO plan</h1>
            <p className="opacity-85 mt-1">
              Logged in as <b>{me?.email || "…"}</b> • {me?.is_paid ? "Pro" : "Demo"}
            </p>
          </div>
          <Link href="/dashboard" className="text-sm underline text-blue-300 hover:text-blue-200">
            Back to dashboard
          </Link>
        </header>

        <section className="bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800">
          <h2 className="text-lg font-semibold">Choose your plan</h2>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Pro card */}
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-5">
              <h3 className="font-semibold text-emerald-200">Upgrade — Pro</h3>
              <p className="text-sm opacity-90 mt-1">For individual power users</p>
              <ul className="text-sm opacity-80 mt-2 list-disc pl-5 space-y-1">
                <li>Full analysis engine (OpenAI)</li>
                <li>Priority processing</li>
                <li>Email support</li>
              </ul>
              <button
                onClick={onClickPro}
                disabled={busy || stage==="checkout" || stage==="processing"}
                className="mt-4 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
              >
                {stage==="checkout" ? "Starting checkout…" : stage==="processing" ? "Processing…" : "Upgrade – Pro"}
              </button>
            </div>

            {/* Premium card */}
            <div className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-5">
              <h3 className="font-semibold text-fuchsia-200">Upgrade — Premium</h3>
              <p className="text-sm opacity-90 mt-1">Team features & custom workflows</p>
              <ul className="text-sm opacity-80 mt-2 list-disc pl-5 space-y-1">
                <li>Shared credits & seats</li>
                <li>Custom integrations</li>
                <li>SLAs & onboarding</li>
              </ul>
              <button
                onClick={onClickPremium}
                className="mt-4 w-full py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500"
              >
                Contact us
              </button>
            </div>
          </div>

          {/* Friendly error */}
          {err && (
            <div className="mt-4 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200">
              <h3 className="font-semibold mb-1">We hit a snag</h3>
              <p className="text-sm">{err}</p>
            </div>
          )}

          {/* Processing note after Razorpay success (webhook does the real upgrade) */}
          {stage === "processing" && (
            <div className="mt-4 p-4 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-200">
              <h3 className="font-semibold">Payment received</h3>
              <p className="text-sm mt-1">
                We’re confirming your payment. Your account will switch to <b>Pro</b> as soon as the provider’s
                confirmation arrives (usually within a minute). You’ll be redirected automatically.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Contact sheet (Premium) */}
      {contactOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Talk to us about Premium</h3>
            <p className="text-sm opacity-85 mt-1">
              We’ll tailor CAIO for your team. Click below to email us; we’ll get back within 24 hours.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={mailToPremium}
                className="px-4 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500"
              >
                Email us
              </button>
              <button
                onClick={() => setContactOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
