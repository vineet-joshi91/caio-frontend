"use client";

import React, { useMemo } from "react";

function tryExtractJsonFromStdout(stdout?: string): any | null {
  if (!stdout) return null;

  // Find the JSON object inside logs: take substring from first "{" to last "}"
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const candidate = stdout.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function valOrDash(v: any) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" && v.trim() === "") return "—";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function BOSSummary({
  ui,
  title = "Executive Action Plan",
}: {
  ui: any;
  title?: string;
}) {
  // Support:
  // 1) ui already structured (direct keys)
  // 2) ui.stdout contains JSON block
  const parsed = useMemo(() => {
    if (!ui) return null;
    if (ui.executive_summary || ui._meta || ui.top_priorities) return ui;
    const extracted = tryExtractJsonFromStdout(ui.stdout);
    return extracted || ui;
  }, [ui]);

  const engine =
    parsed?._meta?.engine ||
    parsed?.engine ||
    ui?._meta?.engine ||
    "—";

  const model =
    parsed?._meta?.model ||
    parsed?.model ||
    ui?._meta?.model ||
    "—";

  const confidence =
    parsed?.confidence ??
    parsed?._meta?.confidence ??
    ui?.confidence ??
    ui?._meta?.confidence ??
    0;

  const executiveSummary =
    parsed?.executive_summary ||
    parsed?.summary ||
    parsed?.ui?.executive_summary ||
    "";

  const topPriorities: string[] = Array.isArray(parsed?.top_priorities)
    ? parsed.top_priorities
    : [];

  const keyRisks: string[] = Array.isArray(parsed?.key_risks)
    ? parsed.key_risks
    : [];

  const actions7d: string[] = Array.isArray(parsed?.cross_brain_actions_7d)
    ? parsed.cross_brain_actions_7d
    : [];

  const actions30d: string[] = Array.isArray(parsed?.cross_brain_actions_30d)
    ? parsed.cross_brain_actions_30d
    : [];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="text-xs opacity-70">
          Confidence:{" "}
          <span className="font-semibold">{Math.round(confidence * 100)}%</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
          <div className="text-xs opacity-70">Model</div>
          <div className="mt-1 text-sm font-semibold">{valOrDash(model)}</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
          <div className="text-xs opacity-70">Engine</div>
          <div className="mt-1 text-sm font-semibold">{valOrDash(engine)}</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
          <div className="text-xs opacity-70">Meta</div>
          <div className="mt-1 text-xs opacity-85">
            {parsed?._meta ? JSON.stringify(parsed._meta) : "{}"}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
        <div className="text-xs opacity-70">Executive Summary</div>
        <div className="mt-2 text-sm leading-relaxed">
          {executiveSummary || "—"}
        </div>
      </div>

      {(topPriorities.length > 0 || keyRisks.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
            <div className="text-xs opacity-70">Top Priorities</div>
            <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
              {topPriorities.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
            <div className="text-xs opacity-70">Key Risks</div>
            <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
              {keyRisks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {(actions7d.length > 0 || actions30d.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
            <div className="text-xs opacity-70">Actions (7 days)</div>
            <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
              {actions7d.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
            <div className="text-xs opacity-70">Actions (30 days)</div>
            <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
              {actions30d.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Optional debug */}
      {ui?.stdout && (
        <details className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
          <summary className="cursor-pointer text-xs font-semibold opacity-80">
            Debug: raw stdout/stderr
          </summary>
          <pre className="mt-2 max-h-[360px] overflow-auto text-xs opacity-80">
            {ui.stdout}
          </pre>
          {ui.stderr && (
            <pre className="mt-2 max-h-[240px] overflow-auto text-xs text-red-200">
              {ui.stderr}
            </pre>
          )}
        </details>
      )}
    </section>
  );
}
