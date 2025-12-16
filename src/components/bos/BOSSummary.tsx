"use client";

import React, { useMemo } from "react";

type UIBlock = {
  executive_summary?: string;
  summary?: string;
  confidence?: number;
  _meta?: {
    model?: string;
    engine?: string;
    confidence?: number;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

export function BOSSummary({
  ui,
  title = "BOS Summary",
  className = "",
}: {
  ui: UIBlock | null | undefined;
  title?: string;
  className?: string;
}) {
  const view = useMemo(() => {
    const u = ui ?? {};
    const conf =
      typeof u.confidence === "number"
        ? u.confidence
        : typeof u._meta?.confidence === "number"
        ? u._meta.confidence
        : 0;

    return {
      executive: u.executive_summary || u.summary || "—",
      confidencePct: Math.round(conf * 100),
      model: u._meta?.model ?? "—",
      engine: u._meta?.engine ?? "—",
      meta: u._meta ?? {},
    };
  }, [ui]);

  return (
    <section className={`rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl ${className}`}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="text-xs opacity-70">
          Confidence: <span className="font-semibold">{view.confidencePct}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="text-xs opacity-70">Model</div>
          <div className="text-sm font-medium">{view.model}</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="text-xs opacity-70">Engine</div>
          <div className="text-sm font-medium">{view.engine}</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="text-xs opacity-70">Meta</div>
          <pre className="mt-1 max-h-24 overflow-auto text-xs opacity-90">
            {JSON.stringify(view.meta, null, 2)}
          </pre>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <div className="mb-1 text-xs opacity-70">Executive Summary</div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{view.executive}</div>
      </div>
    </section>
  );
}
