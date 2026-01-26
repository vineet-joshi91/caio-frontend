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

function extractLastJsonObject(text: string): any | null {
  if (!text) return null;

  const starts: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") starts.push(i);
  }
  if (starts.length === 0) return null;

  // Try from end: find last complete brace-balanced JSON object
  for (let s = starts.length - 1; s >= 0; s--) {
    const start = starts[s];
    let depth = 0;
    let inStr = false;
    let esc = false;

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

function normalizeEAResponse(data: any): any {
  // Expect { ui: {...} } but allow other shapes
  const ui = data?.ui ?? data ?? {};
  if (!ui || typeof ui !== "object") return data;

  // If EA fields are already present, return as-is
  if (ui.executive_summary || ui.top_priorities || ui.owner_matrix) {
    return { ui };
  }

  // Otherwise, try to parse last JSON object from stdout
  const stdout = typeof ui.stdout === "string" ? ui.stdout : "";
  const parsed = extractLastJsonObject(stdout);

  if (parsed && typeof parsed === "object" && (parsed.executive_summary || parsed.top_priorities)) {
    // Carry forward debug + meta fields
    const merged = {
      ...parsed,
      stdout: ui.stdout ?? "",
      stderr: ui.stderr ?? "",
      returncode: ui.returncode ?? 0,
      warnings: ui.warnings ?? [],
      extract_meta: ui.extract_meta ?? null,
    };
    return { ui: merged };
  }

  // Fallback: return whatever we got
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

  console.log("BOSUploadPanel vNEXT: parsing stdout into ui fields");

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
    try {
      const fd = new FormData();
      fd.append("file", file);

      // Optional tuning params (backend supports query params)
      const url = new URL(`${BOS_BASE}/upload-and-ea`);
      url.searchParams.set("timeout_sec", "600");
      url.searchParams.set("num_predict", "768");
      // planTier is used by frontend; backend may ignore it here (fine).

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tok}`,
        },
        body: fd,
      });

      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        // if backend returns non-json, keep raw message
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

      // data should match EAResponse shape or contain { ui: ... }
      const normalized = normalizeEAResponse(data);
      onRunComplete?.(normalized as EAResponse);

    } catch (e: any) {
      setErr(e?.message || "Analyze failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl ${className}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Upload & Analyze</h2>
          <div className="text-xs opacity-70">
            Upload a real business file → get a unified executive action plan
          </div>
        </div>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canRun}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white shadow hover:bg-blue-500 disabled:opacity-60"
        >
          {running ? "Analyzing…" : "Analyze file"}
          {running && (
            <div className="mt-3 rounded-xl border border-blue-400/20 bg-blue-500/10 p-3 text-sm text-blue-100">
                <div className="font-semibold">Analysis in progress</div>
                <div className="opacity-90">
                Please be patient — complex files can take 30–90 seconds.
                </div>
            </div>
            )}

        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <input
          type="file"
          className="block w-full text-sm text-zinc-200 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-zinc-100 hover:file:bg-zinc-700"
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

        <div className="text-xs opacity-60">
          Tip: Start with a PDF or a short document first. Larger files take longer.
        </div>
      </div>
    </section>
  );
}
