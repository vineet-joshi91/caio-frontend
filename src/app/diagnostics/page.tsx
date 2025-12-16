"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { runEA, type EAResponse } from "@/lib/validator";

const pretty = (v: unknown) =>
  typeof v === "string" ? v : JSON.stringify(v, null, 2);

export default function DiagnosticsPage() {
  const [apiBase, setApiBase] = useState("https://caioinsights.com");
  const [model, setModel] = useState("qwen2.5:0.5b-instruct");
  const [timeoutMs, setTimeoutMs] = useState<number>(60_000);
  const [numPredict, setNumPredict] = useState<number>(256);

  const [packetText, setPacketText] = useState<string>(() =>
    JSON.stringify(
      {
        label: "Diagnostics Demo",
        bos_index: 0.3,
        findings: [],
        insights: {},
        meta: { currency: "INR", unit: "actual" },
      },
      null,
      2
    )
  );

  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [raw, setRaw] = useState<EAResponse | null>(null);
  const [err, setErr] = useState<string>("");

  // Persist apiBase for convenience
  useEffect(() => {
    try {
      const saved = localStorage.getItem("caio_diag_api");
      if (saved) setApiBase(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("caio_diag_api", apiBase);
    } catch {}
  }, [apiBase]);

  const summary = useMemo(() => {
    const ui = raw?.ui ?? {};
    const conf =
      typeof ui.confidence === "number"
        ? ui.confidence
        : typeof ui._meta?.confidence === "number"
        ? ui._meta.confidence
        : 0;

    return {
      confidencePct: Math.round(conf * 100),
      model: ui._meta?.model ?? "—",
      engine: ui._meta?.engine ?? "—",
      executive: ui.executive_summary || ui.summary || "No summary returned.",
    };
  }, [raw]);

  const onFile = useCallback(async (file: File) => {
    const text = await file.text();
    setPacketText(text);
    setFileName(file.name);
  }, []);

  const onRun = useCallback(async () => {
    setLoading(true);
    setErr("");
    setRaw(null);

    let packet: unknown;
    try {
      packet = JSON.parse(packetText);
    } catch (e: any) {
      setErr(`Invalid JSON: ${e?.message || String(e)}`);
      setLoading(false);
      return;
    }

    try {
      // Diagnostics uses BOS directly (userId 0, demo tier)
      const out = await runEA(packet, {
        userId: 0,
        planTier: "demo",
        model,
        timeoutSec: Math.max(5, Math.floor(timeoutMs / 1000)),
        numPredict,
      });

      setRaw(out);
    } catch (e: any) {
      setErr(e?.message || "Failed to execute BOS run");
    } finally {
      setLoading(false);
    }
  }, [model, numPredict, packetText, timeoutMs]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold">CAIO BOS · Diagnostics</h1>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm opacity-80">API Base</span>
          <input
            className="rounded border bg-transparent px-3 py-2"
            value={apiBase}
            onChange={(e) => setApiBase(e.currentTarget.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm opacity-80">Model</span>
          <input
            className="rounded border bg-transparent px-3 py-2"
            value={model}
            onChange={(e) => setModel(e.currentTarget.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm opacity-80">Timeout (ms)</span>
          <input
            type="number"
            min={5000}
            step={1000}
            className="rounded border bg-transparent px-3 py-2"
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(Number(e.currentTarget.value || 0))}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm opacity-80">Tokens (num_predict)</span>
          <input
            type="number"
            min={64}
            step={64}
            className="rounded border bg-transparent px-3 py-2"
            value={numPredict}
            onChange={(e) => setNumPredict(Number(e.currentTarget.value || 0))}
          />
        </label>
      </div>

      <div className="mb-4 rounded border p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="font-medium">POST /run-ea</span>

          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                if (f) void onFile(f);
              }}
            />
            <button
              onClick={onRun}
              disabled={loading}
              className="rounded bg-red-500 px-4 py-2 text-white disabled:opacity-60"
            >
              {loading ? "Running…" : "Run BOS"}
            </button>
          </div>
        </div>

        <textarea
          value={packetText}
          onChange={(e) => setPacketText(e.currentTarget.value)}
          rows={16}
          spellCheck={false}
          className="w-full resize-y rounded border bg-transparent p-2 font-mono text-sm"
        />

        {!!fileName && (
          <div className="mt-2 text-xs opacity-70">Loaded file: {fileName}</div>
        )}
      </div>

      {!!err && (
        <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm">
          {err}
        </div>
      )}

      {raw && (
        <details open className="mb-6">
          <summary className="cursor-pointer font-medium">
            HTTP 200 · Raw BOS Output
          </summary>
          <pre className="mt-2 max-h-[420px] overflow-auto rounded border p-3 text-sm">
            {pretty(raw)}
          </pre>
        </details>
      )}

      <section className="rounded border p-4">
        <h2 className="mb-3 text-lg font-semibold">BOS Summary</h2>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded border p-3">
            <div className="text-sm opacity-70">Confidence</div>
            <div className="text-xl font-semibold">{summary.confidencePct}%</div>
          </div>

          <div className="rounded border p-3">
            <div className="text-sm opacity-70">Model</div>
            <div>{summary.model}</div>
          </div>

          <div className="rounded border p-3">
            <div className="text-sm opacity-70">Engine</div>
            <div>{summary.engine}</div>
          </div>
        </div>

        <div className="rounded border p-3">
          <div className="mb-1 text-sm opacity-70">Executive Summary</div>
          <div>{summary.executive}</div>
        </div>
      </section>
    </div>
  );
}
