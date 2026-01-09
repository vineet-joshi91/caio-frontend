"use client";

import type { BrainId, BrainPayload } from "@/types/caio";
import { ChartRenderer } from "@/components/charts/ChartRenderer";

interface BrainPanelProps {
  id: Exclude<BrainId, "ea">; // cfo, coo, cmo, chro, cpo
  data?: BrainPayload;
}

export function BrainPanel({ id, data }: BrainPanelProps) {
  const rec = data?.recommendation ?? {};
  const charts = data?.tools?.charts ?? [];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <section className="p-4 border border-slate-800 rounded-2xl bg-slate-950/40">
        <h2 className="text-xl font-semibold mb-2 uppercase">
          {id} Summary
        </h2>
        <p className="text-sm text-slate-200 whitespace-pre-wrap">
          {rec.summary || "No summary available."}
        </p>
      </section>

      {/* Actions buckets */}
      <section className="grid gap-4 md:grid-cols-2">
        <ActionList title="Next 7 days" items={rec.actions_7d} />
        <ActionList title="Next 30 days" items={rec.actions_30d} />
        <ActionList title="This quarter" items={rec.actions_quarter} />
        <ActionList title="Next half-year" items={rec.actions_half_year} />
        <ActionList title="Next year" items={rec.actions_year} />
      </section>

      {/* KPIs / Risks */}
      <section className="grid gap-4 md:grid-cols-2">
        <ActionList title="KPIs to watch" items={rec.kpis_to_watch} />
        <ActionList title="Key risks" items={rec.risks} />
      </section>

      {/* Charts */}
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
