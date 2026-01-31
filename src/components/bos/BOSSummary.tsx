"use client";

import React, { useMemo } from "react";

function extractDecisionJsonFromStdout(stdout?: string): any | null {
  if (!stdout) return null;

  // Try to parse the final JSON block printed at the end of stdout
  const idx = stdout.lastIndexOf("\n{");
  const start = idx >= 0 ? idx + 1 : stdout.lastIndexOf("{");
  if (start < 0) return null;

  const candidate = stdout.slice(start).trim();
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

function asStringList(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
    .map((s) => s.trim())
    .filter(Boolean);
}

export function BOSSummary({
  ui,
  title = "Executive Action Plan",
  showDiagnostics = false,
}: {
  ui: any;
  title?: string;
  showDiagnostics?: boolean;
}) {

  const parsed = useMemo(() => {
    if (!ui) return null;

    // If already structured EA/DR, use directly
    if (
      ui.executive_summary ||
      ui.plan_summary ||
      ui.review_summary || // legacy
      ui._meta ||
      ui.top_priorities ||
      ui.critical_gaps ||
      ui.recommendation
    ) {
      return ui;
    }

    const extracted = extractDecisionJsonFromStdout(ui.stdout);
    return extracted || ui;
  }, [ui]);

  const engine = parsed?._meta?.engine || parsed?.engine || ui?._meta?.engine || "—";
  const model = parsed?._meta?.model || parsed?.model || ui?._meta?.model || "—";

  const confidence =
    parsed?.confidence ??
    parsed?._meta?.confidence ??
    ui?.confidence ??
    ui?._meta?.confidence ??
    0;

  const isDecisionReview =
    !!parsed?.plan_summary ||
    !!parsed?.recommendation ||
    title.toLowerCase().includes("decision review");

  // ==========================
  // Decision Review fields (NEW SCHEMA)
  // ==========================
  const planSummary: string =
    parsed?.plan_summary ||
    parsed?.review_summary || // legacy support
    "";

  const criticalGaps = asStringList(parsed?.critical_gaps);
  const missingMetrics = asStringList(parsed?.missing_metrics);
  const riskFlags = asStringList(parsed?.risk_flags);

  const recommendation = parsed?.recommendation && typeof parsed.recommendation === "object"
    ? parsed.recommendation
    : null;

  const verdict: string = recommendation?.verdict || "—";
  const why: string[] = asStringList(recommendation?.why);
  const nextSteps: string[] = asStringList(recommendation?.next_steps);

  // ==========================
  // Executive Plan fields
  // ==========================
  const executiveSummary =
    parsed?.executive_summary ||
    parsed?.summary ||
    parsed?.ui?.executive_summary ||
    "";

  const topPriorities = asStringList(parsed?.top_priorities);
  const keyRisks = asStringList(parsed?.key_risks);
  const actions7d = asStringList(parsed?.cross_brain_actions_7d);
  const actions30d = asStringList(parsed?.cross_brain_actions_30d);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="text-xs opacity-70">
          Confidence: <span className="font-semibold">{Math.round(confidence * 100)}%</span>
        </div>
      </div>

      {showDiagnostics && (
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
      )}

      {/* ==========================
          Decision Review layout
         ========================== */}
      {isDecisionReview ? (
        <>
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
            <div className="text-xs opacity-70">Plan Summary</div>
            <div className="mt-2 text-sm leading-relaxed">
              {planSummary || "—"}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
              <div className="text-xs opacity-70">Critical Gaps</div>
              <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                {(criticalGaps.length ? criticalGaps : ["—"]).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
              <div className="text-xs opacity-70">Missing Metrics</div>
              <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                {(missingMetrics.length ? missingMetrics : ["—"]).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4 md:col-span-2">
              <div className="text-xs opacity-70">Risk Flags</div>
              <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                {(riskFlags.length ? riskFlags : ["—"]).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
            <div className="text-xs opacity-70">Recommendation</div>

            <div className="mt-2 text-sm">
              <span className="font-semibold">Verdict:</span> {verdict || "—"}
            </div>

            <div className="mt-3">
              <div className="text-xs opacity-70">Why</div>
              <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                {(why.length ? why : ["—"]).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>

            <div className="mt-3">
              <div className="text-xs opacity-70">Next steps</div>
              <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                {(nextSteps.length ? nextSteps : ["—"]).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : (
        /* ==========================
           Executive Plan layout
           ========================== */
        <>
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
        </>
      )}

      {/* Optional debug */}
      {showDiagnostics && ui?.stdout && (
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
