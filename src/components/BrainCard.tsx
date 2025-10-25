"use client";

import React from "react";
import BrainChip from "@/components/BrainChip";
import ShimmerBlock from "@/components/ShimmerBlock";

export default function BrainCard({
  role,
  tagline,
  points,
  loading,
}: {
  role: string;          // "CFO", "COO", etc.
  tagline: string;       // "Cash, burn, runway"
  points?: string[];     // bullet list from that brain
  loading?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-neutral-700 bg-neutral-900/50 p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <BrainChip role={role} tagline={tagline} />
        <div className="text-[11px] text-neutral-500 leading-none sm:text-right">
          {role} focus: {tagline}
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <ShimmerBlock lines={5} />
        ) : (
          <ul className="list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-neutral-200">
            {points?.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
