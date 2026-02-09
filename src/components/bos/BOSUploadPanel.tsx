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
function extractAllJsonObjects(text: string): any[] {
  const out: any[] = [];
  if (!text) return out;

  for (let start = 0; start < text.length; start++) {
    if (text[start] !== "{") continue;

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
              out.push(JSON.parse(candidate));
              start = i; // jump forward
            } catch {
              // ignore
            }
            break;
          }
        }
      }
    }
  }

  return out;
}

function pickBestEA(objs: any[]): any | null {
  // Prefer objects that look like EA output
  const candidates = objs.filter(o =>
    o &&
    typeof o === "object" &&
    (typeof o.executive_summary === "string" || typeof o.executive_summary === "string") &&
    (Array.isArray(o.top_priorities) || Array.isArray(o.top_priorities))
  );

  // If multiple, pick the one with most content
  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      const al = (a.executive_summary?.length || 0) + (a.top_priorities?.length || 0);
      const bl = (b.executive_summary?.length || 0) + (b.top_priorities?.length || 0);
      return bl - al;
    });
    return candidates[0];
  }

  return null;
}



function looksLikeEA(obj: any) {
  if (!obj || typeof obj !== "object") return false;
  const o = obj.ui && typeof obj.ui === "object" ? obj.ui : obj;

  return (
    typeof o.executive_summary === "string" ||
    Array.isArray(o.top_priorities) ||
    (o.owner_matrix && typeof o.owner_matrix === "object")
  );
}

// Tries many candidates from stdout and returns the FIRST best EA-looking object.
function extractBestEAObject(stdout: string): any | null {
  if (!stdout) return null;

  // Strategy: scan from the end, try to JSON.parse at many "{"
  // and keep the first parsed object that "looks like EA".
  for (let i = stdout.length - 1; i >= 0; i--) {
    if (stdout[i] !== "{") continue;

    const slice = stdout.slice(i);
    // stop huge parsing attempts
    if (slice.length > 20000) continue;

    try {
      const parsed = JSON.parse(slice);
      if (looksLikeEA(parsed)) {
        return parsed.ui && typeof parsed.ui === "object" ? parsed.ui : parsed;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

function normalizeEAResponse(data: any): any {
  const ui = data?.ui ?? data ?? {};
  if (!ui || typeof ui !== "object") return { ui: {} };

  // 1) If EA fields already exist, trust them immediately
  if (ui.executive_summary || ui.top_priorities || ui.owner_matrix) {
    return { ui };
  }

  // 2) Otherwise recover from stdout (pick BEST match, not LAST)
  const stdout = typeof ui.stdout === "string" ? ui.stdout : "";
  const best = extractBestEAObject(stdout);

  if (best) {
    return {
      ui: {
        ...best,
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
