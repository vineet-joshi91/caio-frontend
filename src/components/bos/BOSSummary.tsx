"use client";

import React, { useMemo } from "react";

/**
 * Extract the LAST complete JSON object from stdout (brace-balanced).
 * This avoids greedy "first { to last }" problems when stdout contains multiple JSON blobs.
 */
function extractLastJsonObject(stdout?: string): any | null {
  if (!stdout) return null;

  const starts: number[] = [];
  for (let i = 0; i < stdout.length; i++) {
    if (stdout[i] === "{") starts.push(i);
  }
  if (starts.length === 0) return null;

  for (let s = starts.length - 1; s >= 0; s--) {
    const start = starts[s];
    let depth = 0;
    let inStr = false;
    let esc = false;

    for (let i = start; i < stdout.length; i++) {
      const ch = stdout[i];

      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      } else {
        if (ch === '"') inStr = true;
        else if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            const candidate = stdout.slice(start, i + 1);
            try {
              return JSON.parse(candidate);
            } catch {
              break;
            }
          }
        }
      }
    }
  }
  return null;
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
}: {
  ui: any;
  title?: string;
}) {
  // Support:
  // 1) ui already structured (direct keys)
  // 2) ui.stdout contains JSON block
  const parsed = useMemo(() => {
    if (!ui) return null;

    // If ui already looks like EA or Decision Review, use it
    if (
      ui.executive_summary ||
      ui.review_summary ||
      ui._meta ||
      ui.top_priorities ||
      ui.critical_gaps
    ) {
      return ui;
    }

    const extracted = extractLastJsonObject(ui.stdout);
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

  // Detect mode: Decision Review vs Executive Plan
  const isDecisionReview =
    !!parsed?.review_summary ||
    !!parsed?.critical_gaps ||
    title.toLowerCase().includes("decision review");

  // ==========================
  // Decision Review fields
  // ==========================
  const reviewSummary = parsed?.review_summary || "";

  const strengths = asStringList(parsed?.strengths);
  const gaps = asStringList(parsed?.gaps);
  const criticalGaps = asStringList(parsed?.critical_gaps);
  const riskFlags = asStringList(parsed?.risk_flags);
  const missingMetrics = asStringList(parsed?.missing_metrics);
  const fixes7d = asStringList(parsed?.fixes_7d);
  const fixes30d = asStringList(parsed?.fixes_30d);

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

      {/* ==========================
          Decision Review layout
         ========================== */}
      {isDecisionReview ? (
        <>
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
            <div className="text-xs opacity-70">Review Summary</div>
            <div className="mt-2 text-sm leading-relaxed">
              {reviewSummary || "—"}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {(strengths.length > 0 || gaps.length > 0) && (
              <>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
                  <div className="text-xs opacity-70">Strengths</div>
                  <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                    {(strengths.length ? strengths : ["—"]).map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
                  <div className="text-xs opacity-70">Gaps</div>
                  <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                    {(gaps.length ? gaps : ["—"]).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {criticalGaps.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
                <div className="text-xs opacity-70">Critical Gaps</div>
                <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                  {criticalGaps.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {riskFlags.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
                <div className="text-xs opacity-70">Risk Flags</div>
                <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                  {riskFlags.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {missingMetrics.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
                <div className="text-xs opacity-70">Missing Metrics</div>
                <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                  {missingMetrics.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {(fixes7d.length > 0 || fixes30d.length > 0) && (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
                <div className="text-xs opacity-70">Fixes (7 days)</div>
                <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                  {(fixes7d.length ? fixes7d : ["—"]).map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
                <div className="text-xs opacity-70">Fixes (30 days)</div>
                <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                  {(fixes30d.length ? fixes30d : ["—"]).map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
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
