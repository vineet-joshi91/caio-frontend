"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ChartSpec } from "@/types/caio";

interface ChartRendererProps {
  chart: ChartSpec;
}

/**
 * Top-level chart renderer.
 * Later we can extend this to support line, pie, heatmap, etc.
 */
export function ChartRenderer({ chart }: ChartRendererProps) {
  switch (chart.type) {
    case "bar":
      return <BarChartRenderer chart={chart} />;

    default:
      return (
        <div className="p-4 border border-slate-800 rounded-2xl bg-slate-950/40">
          <h3 className="font-semibold mb-2 text-slate-50">{chart.title}</h3>
          <p className="text-sm text-slate-400">
            Unsupported chart type: <code>{chart.type}</code>
          </p>
        </div>
      );
  }
}

interface BarChartRendererProps {
  chart: ChartSpec;
}

/**
 * Handles:
 *  - Simple bar: one metric per category
 *  - Grouped bar: uses series_field (e.g. Budget vs Actual)
 */
function BarChartRenderer({ chart }: BarChartRendererProps) {
  const { x, y, data, title, series_field } = chart;

  // ---------- SIMPLE BAR: no series_field ----------
  if (!series_field) {
    return (
      <div className="p-4 border border-slate-800 rounded-2xl bg-slate-950/40">
        <h3 className="font-semibold mb-3 text-slate-50">{title}</h3>
        <div className="text-xs text-slate-400 mb-2">
          {x.label && <span className="mr-4">X: {x.label}</span>}
          {y.label && (
            <span>
              Y: {y.label}
              {y.unit ? ` (${y.unit})` : ""}
            </span>
          )}
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey={x.field} />
              <YAxis />
              <Tooltip
                formatter={(value: any) =>
                  typeof value === "number" ? value.toLocaleString() : value
                }
              />
              <Bar dataKey={y.field} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // ---------- GROUPED BAR: series_field present ----------
  // Input shape (from backend):
  //   [
  //     { brain: "CMO", kind: "Budget", value: 2000000 },
  //     { brain: "CMO", kind: "Actual", value: 2600000 },
  //     ...
  //   ]
  //
  // We reshape to:
  //   [
  //     { brain: "CMO", Budget: 2000000, Actual: 2600000 },
  //     ...
  //   ]
  const rowsByX: Record<string, any> = {};

  for (const row of data) {
    const xKey = row[x.field];
    const seriesName = row[series_field];
    const val = row[y.field];

    if (xKey == null || seriesName == null) continue;

    if (!rowsByX[xKey]) {
      rowsByX[xKey] = { [x.field]: xKey };
    }
    rowsByX[xKey][seriesName] = val;
  }

  const reshaped = Object.values(rowsByX);
  const seriesNames = Array.from(
    new Set(
      data
        .map((row) => row[series_field])
        .filter((v) => v !== null && v !== undefined)
    )
  );

  return (
    <div className="p-4 border border-slate-800 rounded-2xl bg-slate-950/40">
      <h3 className="font-semibold mb-3 text-slate-50">{title}</h3>
      <div className="text-xs text-slate-400 mb-2">
        {x.label && <span className="mr-4">X: {x.label}</span>}
        {y.label && (
          <span>
            Y: {y.label}
            {y.unit ? ` (${y.unit})` : ""}
          </span>
        )}
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={reshaped as any[]}>
            <XAxis dataKey={x.field} />
            <YAxis />
            <Tooltip
              formatter={(value: any) =>
                typeof value === "number" ? value.toLocaleString() : value
              }
            />
            <Legend />
            {seriesNames.map((name) => (
              <Bar key={String(name)} dataKey={String(name)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
