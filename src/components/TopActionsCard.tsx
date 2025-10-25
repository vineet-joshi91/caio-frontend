"use client";

import React from "react";
import ShimmerBlock from "@/components/ShimmerBlock";

export default function TopActionsCard({
  actions,
  loading,
}: {
  actions?: string[];
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-neutral-700 bg-neutral-900/70 p-4 text-neutral-100 shadow-md">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
        Your Top 3 Actions
      </div>

      {loading ? (
        <div className="mt-3">
          <ShimmerBlock lines={4} />
        </div>
      ) : (
        <ol className="mt-3 list-decimal space-y-2 pl-4 text-[14px] leading-relaxed text-neutral-200">
          {actions?.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      )}

      <div className="mt-3 text-[11px] text-neutral-500 leading-relaxed">
        CAIO prioritizes urgency, cost impact, and investor optics.
      </div>
    </div>
  );
}
