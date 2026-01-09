"use client";

import type { EAUi, ChartSpec } from "@/types/caio";
import { ChartRenderer } from "@/components/charts/ChartRenderer";

interface EAOverviewProps {
  ui: EAUi;
}

export function EAOverview({ ui }: EAOverviewProps) {
  const charts: ChartSpec[] = ui?.tools?.charts ?? [];

  return (
    <div className="space-y-4">
      {/* Executive summary */}
      <section className="p-4 border border-slate-800 rounded-2xl bg-slate-950/40">
        <h2 className="text-xl font-semibold mb-2 text-slate-50">
          Executive Summary
        </h2>
        <p className="text-sm text-slate-200 whitespace-pre-wrap">
          {ui?.executive_summary || "No executive summary available."}
        </p>
      </section>

      {/* Cross-brain actions */}
      <section className="grid gap-4 md:grid-cols-2">
        <ActionList title="Cross-brain actions (next 7 days)" items={ui?.cross_brain_actions_7d} />
        <ActionList title="Cross-brain actions (next 30 days)" items={ui?.cross_brain_actions_30d} />
      </section>

      {/* Themes & risks */}
      <section className="grid gap-4 md:grid-cols-2">
        <ActionList title="Strategic themes" items={ui?.themes} />
        <ActionList title="Top risks" items={ui?.top_risks} />
      </section>

      {/* EA-level charts */}
      {charts.length > 0 && (
        <section className="space-y-4">
          {charts.map((chart) => (
            <ChartRenderer key={chart.id} chart={chart} />
          ))}
        </section>
      )}
    </div>
  );
}

function ActionList({
  title,
  items,
}: {
  title: string;
  items?: string[];
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="p-4 border border-slate-800 rounded-2xl bg-slate-950/40">
      <h3 className="font-semibold mb-2 text-slate-50">{title}</h3>
      <ul className="list-disc list-inside text-sm space-y-1 text-slate-200">
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
