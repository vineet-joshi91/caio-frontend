"use client";

import React from "react";

export default function ConfidenceBanner({
  authenticity,
  consistency,
  financeCheck,
}: {
  authenticity: string;
  consistency: string;
  financeCheck: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-700 bg-neutral-900/70 p-4 text-sm text-neutral-200 shadow-inner">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
        CAIO Confidence & Limitations
      </div>

      <div className="mt-3 grid gap-3 text-neutral-300 md:grid-cols-3">
        <div className="rounded-lg bg-neutral-800/50 p-3 border border-neutral-700/60">
          <div className="text-[11px] uppercase text-neutral-500 font-medium tracking-wide">
            Document authenticity
          </div>
          <div className="mt-1 text-[13px] leading-relaxed">{authenticity}</div>
        </div>

        <div className="rounded-lg bg-neutral-800/50 p-3 border border-neutral-700/60">
          <div className="text-[11px] uppercase text-neutral-500 font-medium tracking-wide">
            Internal consistency
          </div>
          <div className="mt-1 text-[13px] leading-relaxed">{consistency}</div>
        </div>

        <div className="rounded-lg bg-neutral-800/50 p-3 border border-neutral-700/60">
          <div className="text-[11px] uppercase text-neutral-500 font-medium tracking-wide">
            Financial math
          </div>
          <div className="mt-1 text-[13px] leading-relaxed">{financeCheck}</div>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-neutral-500 leading-relaxed">
        CAIO flags risk. You own final judgment.
      </div>
    </div>
  );
}
