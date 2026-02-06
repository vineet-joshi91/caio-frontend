"use client";

import React, { useMemo, useState } from "react";
import { type EAResponse, type PlanTier } from "@/lib/validator";

const BOS_BASE =
  (process.env.NEXT_PUBLIC_BOS_BASE &&
    process.env.NEXT_PUBLIC_BOS_BASE.trim().replace(/\/+$/, "")) ||
  "https://caioinsights.com";

function readTokenSafe(): string {
  try {
    return (
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      ""
    );
  } catch {
    return "";
  }
}

/**
 * Extract the last brace-balanced JSON object from a string.
 * IMPORTANT: We only scan the tail to avoid freezing the UI on huge stdout.
 */
function extractLastEAObject(text: string): any | null {
  if (!text) return null;

  const starts: number[] = [];
  for (let i = 0; i < text.length; i++) if (text[i] === "{") starts.push(i);

  for (let s = starts.length - 1; s >= 0; s--) {
    const start = starts[s];
    let depth = 0, inStr = false, esc = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];

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
            const candidate = text.slice(start, i + 1);
            try {
              const obj = JSON.parse(candidate);

              // reject error blobs
              if (obj?.ui?.error) continue;

              // accept EA-like objects
              if (
                obj &&
                typeof obj === "object" &&
                typeof obj.executive_summary === "string" &&
                Array.isArray(obj.top_priorities) &&
                obj.owner_matrix
              ) {
                return obj;
              }
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


function normalizeEAResponse(data: any): any {
  const ui = data?.ui ?? data ?? {};
  if (!ui || typeof ui !== "object") return { ui: {} };

  // ✅ If EA fields exist directly, trust them
  const directEA =
    typeof ui.executive_summary === "string" &&
    Array.isArray(ui.top_priorities) &&
    ui.owner_matrix &&
    typeof ui.owner_matrix === "object";

  if (directEA) return { ui };

  const stdout = typeof ui.stdout === "string" ? ui.stdout : "";

  // ✅ Try to recover EA from stdout (even if stdout ends with an error JSON)
  const parsedEA = extractLastEAObject(stdout);
  if (parsedEA) {
    return {
      ui: {
        ...parsedEA,
        stdout: ui.stdout ?? "",
        stderr: ui.stderr ?? "",
        returncode: ui.returncode ?? 0,
        warnings: ui.warnings ?? [],
        extract_meta: ui.extract_meta ?? null,
      },
    };
  }

  // ✅ If we couldn't recover EA, but backend signaled an error inside ui or stdout, surface it
  const backendErr =
    ui?.error ||
    ui?.detail ||
    ui?.message ||
    (typeof ui?.stderr === "string" && ui.stderr.trim() ? ui.stderr : null);

  if (backendErr) {
    return {
      ui: {
        error: String(backendErr),
        stdout: ui.stdout ?? "",
        stderr: ui.stderr ?? "",
        returncode: ui.returncode ?? 0,
        warnings: ui.warnings ?? [],
        extract_meta: ui.extract_meta ?? null,
      },
    };
  }

  return { ui };
}


export function BOSUploadPanel({
  planTier,
  onRunComplete,
  className = "",
}: {
  planTier: PlanTier;
  onRunComplete?: (resp: EAResponse) => void;
  className?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canRun = useMemo(() => !!file && !running, [file, running]);

  async function onAnalyze() {
    setErr(null);

    if (!file) {
      setErr("Please choose a file first.");
      return;
    }

    const tok = readTokenSafe();
    if (!tok) {
      setErr("Session missing. Please log in again.");
      return;
    }

    setRunning(true);

    const controller = new AbortController();
    const kill = window.setTimeout(() => controller.abort(), 650_000); // ~10m50s hard stop

    try {
      const fd = new FormData();
      fd.append("file", file);

      const url = new URL(`${BOS_BASE}/upload-and-ea`);
      url.searchParams.set("timeout_sec", "600");
      url.searchParams.set("num_predict", "512");
      url.searchParams.set("model", "qwen2.5:3b-instruct");

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}` },
        body: fd,
        signal: controller.signal,
      });

      const raw = await res.text();

      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }

      if (!res.ok) {
        const msg =
          data?.ui?.error ||
          data?.detail ||
          data?.message ||
          raw ||
          `Analyze failed (HTTP ${res.status})`;
        throw new Error(msg);
      }

      const normalized = normalizeEAResponse(data);
      onRunComplete?.(normalized as EAResponse);
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setErr("This is taking unusually long. Please retry once. If it persists, it’s likely OCR/parse overhead.");
      } else {
        setErr(e?.message || "Analyze failed");
      }
    } finally {
      window.clearTimeout(kill);
      setRunning(false);
    }
  }

  return (
    <section
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Upload & Analyze</h2>
          <div className="text-xs opacity-70">
            Upload a business document to generate an Executive Action Plan
          </div>
        </div>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canRun}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm text-white shadow hover:bg-blue-500 disabled:opacity-60"
        >
          {running && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {running ? "Analyzing" : "Analyze file"}
        </button>
      </div>

      {running && (
        <div className="mt-4 rounded-xl border border-blue-400/20 bg-blue-500/10 p-3 text-sm text-blue-100">
          <div className="font-semibold">Processing</div>
          <div className="opacity-90">
            Extracting text and generating your plan…
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3">
        <input
          type="file"
          disabled={running}
          className="block w-full text-sm text-zinc-200 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-zinc-100 hover:file:bg-zinc-700 disabled:opacity-60"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        {file && (
          <div className="text-xs opacity-80">
            Selected: <span className="font-semibold">{file.name}</span>
          </div>
        )}

        {err && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
            {err}
          </div>
        )}
      </div>
    </section>
  );
}
