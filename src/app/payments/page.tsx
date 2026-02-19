"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";

export default function PaymentsPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const startPremium = useCallback(() => {
    window.location.href = "https://rzp.io/rzp/dyD6BmX1";
  }, []);

  const buyCredits = useCallback((pack: "starter" | "growth" | "pro") => {
    const urls = {
      starter: "https://rzp.io/rzp/caio-starter-120",
      growth: "https://rzp.io/rzp/caio-growth-300",
      pro: "https://rzp.io/rzp/caio-pro-600",
    };
    
    window.location.href = urls[pack];
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">

        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Upgrade your CAIO plan</h1>
          <Link
            className="text-sm text-blue-300 underline hover:text-blue-200"
            href="/dashboard"
          >
            Back to dashboard
          </Link>
        </div>

        {/* STANDARD TIER */}
        <div className="mb-6 rounded-2xl border border-zinc-700 bg-zinc-900/40 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide opacity-60 mb-1">
                Standard
              </div>
              <div className="text-2xl font-bold">Free</div>
              <div className="text-sm opacity-70 mt-1">
                100 free credits on signup, buy more as needed
              </div>
            </div>
            <div className="text-xs opacity-50 mt-2">Current plan</div>
          </div>

          <ul className="my-4 space-y-2 text-sm opacity-90">
            <li>✓ Executive Action Plan (10 credits per run)</li>
            <li>✓ 10 document uploads per day</li>
            <li>✓ Decision Review available (50 credits per use)</li>
            <li className="text-amber-400">⚡ Upgrade to Premium for unlimited EA + DR</li>
          </ul>

          {/* Credit Top-up Packs */}
          <div className="mt-6 border-t border-zinc-700 pt-6">
            <div className="text-sm font-semibold mb-4">Buy Credit Packs:</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

              {/* Starter Pack */}
              <div className="rounded-xl border border-zinc-700 bg-zinc-950/40 p-4">
                <div className="text-xs uppercase tracking-wide opacity-60 mb-1">Starter</div>
                <div className="text-xl font-bold">₹999</div>
                <div className="text-xs opacity-60 mt-1">120 credits</div>
                <div className="text-xs opacity-50 mt-2">
                  ~12 only EA runs or 2 EA+DR runs
                </div>
                <button
                  onClick={() => buyCredits("starter")}
                  disabled={loading === "starter"}
                  className="mt-3 w-full rounded-lg bg-zinc-700 px-3 py-2 text-sm hover:bg-zinc-600 disabled:opacity-50"
                >
                  {loading === "starter" ? "Loading..." : "Buy Now"}
                </button>
              </div>

              {/* Growth Pack */}
              <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs uppercase tracking-wide text-blue-400">Growth</div>
                  <div className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">Popular</div>
                </div>
                <div className="text-xl font-bold">₹1,999</div>
                <div className="text-xs opacity-60 mt-1">300 credits</div>
                <div className="text-xs opacity-50 mt-2">
                  30 only EA runs or 5 EA+DR runs
                </div>
                <button
                  onClick={() => buyCredits("growth")}
                  disabled={loading === "growth"}
                  className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500 disabled:opacity-50"
                >
                  {loading === "growth" ? "Loading..." : "Buy Now"}
                </button>
              </div>

              {/* Pro Pack */}
              <div className="rounded-xl border border-zinc-700 bg-zinc-950/40 p-4">
                <div className="text-xs uppercase tracking-wide opacity-60 mb-1">Pro</div>
                <div className="text-xl font-bold">₹3,999</div>
                <div className="text-xs opacity-60 mt-1">600 credits</div>
                <div className="text-xs opacity-50 mt-2">
                  60 only EA runs or 10 EA+DR runs
                </div>
                <button
                  onClick={() => buyCredits("pro")}
                  disabled={loading === "pro"}
                  className="mt-3 w-full rounded-lg bg-zinc-700 px-3 py-2 text-sm hover:bg-zinc-600 disabled:opacity-50"
                >
                  {loading === "pro" ? "Loading..." : "Buy Now"}
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* PREMIUM TIER */}
        <div className="mb-6 rounded-2xl border border-emerald-400/40 bg-emerald-400/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-emerald-400 mb-1">
                Premium
              </div>
              <div className="text-2xl font-bold">
                ₹4,999
                <span className="text-sm font-normal opacity-70">/mo</span>
              </div>
              <div className="text-sm opacity-70 mt-1">
                Unlimited EA and DR - no credit limits
              </div>
            </div>
            <div className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs text-emerald-300">
              Best Value
            </div>
          </div>

          <ul className="my-4 space-y-2 text-sm opacity-90">
            <li>✓ Unlimited Executive Action Plans</li>
            <li>✓ Unlimited Decision Reviews</li>
            <li>✓ No credit deductions</li>
            <li>✓ Priority processing</li>
            <li>✓ Unlimited document uploads</li>
            <li>✓ Priority support</li>
          </ul>

          <button
            onClick={startPremium}
            className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Start Premium - ₹4,999/mo
          </button>

          <div className="mt-3 text-xs text-center opacity-60">
            Save money if you use 10+ Decision Reviews per month
          </div>
        </div>

        {/* FOOTER */}
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4 text-sm opacity-80">
          Payment questions? <a href="mailto:vineetpjoshi.71@gmail.com" className="underline text-blue-300 hover:text-blue-200">Contact support</a>.
        </div>

      </div>
    </main>
  );
}