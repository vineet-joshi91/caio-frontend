"use client";

import React from "react";

const ROLE_STYLES: Record<string, string> = {
  CFO:  "bg-neutral-900 border border-neutral-700 text-neutral-200",
  COO:  "bg-neutral-900 border border-neutral-700 text-neutral-200",
  CHRO: "bg-neutral-900 border border-neutral-700 text-neutral-200",
  CMO:  "bg-neutral-900 border border-neutral-700 text-neutral-200",
  CPO:  "bg-neutral-900 border border-neutral-700 text-neutral-200",
  CAIO: "bg-neutral-800 border border-neutral-600 text-neutral-100",
};

export default function BrainChip({
  role,
  tagline,
}: {
  role: string;
  tagline: string;
}) {
  const style = ROLE_STYLES[role] || ROLE_STYLES["CAIO"];

  return (
    <div
      className={
        "inline-flex items-center gap-2 rounded-xl px-3 py-1 text-xs font-medium leading-none shadow-sm " +
        style
      }
    >
      <span className="uppercase tracking-wide text-[10px] text-neutral-400">
        {role}
      </span>
      <span className="text-neutral-200">{tagline}</span>
    </div>
  );
}
