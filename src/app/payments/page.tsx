"use client";

import React, { useCallback } from "react";
import Link from "next/link";

export default function PaymentsPage() {
  const startPremium = useCallback(() => {
    window.location.href = "https://rzp.io/rzp/dyD6BmX1";
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="mx-auto max-w-3xl">

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
                Pay only when you need more credits
              </div>
            </div>
            <div className="text-xs opacity-50 mt-2">Current plan</div>
          </div>

          <ul className="my-4 space-y-2 text-sm opacity-90">
            <li>✓ Executive Action Plan generation</li>
            <li>✓ 10 document uploads per day</li>
            <li>✓ Top up credits as needed</li>
            <li className="opacity-40">✗ Decision Review (Premium only)</li>
          </ul>

          <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-950/50 p-3 text-sm opacity-70">
            Need more credits? Contact us at <a href="mailto:vineetpjoshi.71@gmail.com" className="text-blue-300 underline">vineetpjoshi.71@gmail.com</a>
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
                ₹7,999
                <span className="text-sm font-normal opacity-70">/mo</span>
              </div>
              <div className="text-sm opacity-70 mt-1">
                Full access to everything CAIO offers
              </div>
            </div>
            <div className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs text-emerald-300">
              Recommended
            </div>
          </div>

          <ul className="my-4 space-y-2 text-sm opacity-90">
            <li>✓ Everything in Standard</li>
            <li>✓ Decision Review - audit your EA for gaps and risks</li>
            <li>✓ Unlimited document uploads</li>
            <li>✓ Lower credit cost per analysis</li>
            <li>✓ Priority support</li>
          </ul>

          <button
            onClick={startPremium}
            className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Start Premium - ₹7,999/mo
          </button>
        </div>

        {/* FOOTER */}
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4 text-sm opacity-80">
          Payment questions? <a href="mailto:vineetpjoshi.71@gmail.com" className="underline text-blue-300 hover:text-blue-200">Contact support</a>.
        </div>

      </div>
    </main>
  );
}