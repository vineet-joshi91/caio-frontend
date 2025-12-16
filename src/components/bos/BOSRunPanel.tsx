"use client";

import React, { useMemo, useState } from "react";
import { runEA, fetchWalletBalance, type EAResponse, type PlanTier } from "@/lib/validator";

const pretty = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));

export function BOSRunPanel({
  userId,
  planTier,
  walletBalance,
  onWalletUpdate,
  defaultPacket,
  className = "",
}: {
  userId: number;
  planTier: PlanTier;
  walletBalance: number | null;
  onWalletUpdate?: (newBalance: number) => void;
  defaultPacket?: unknown;
  className?: string;
}) {
  const [packetText, setPacketText] = useState<string>(() =>
    JSON.stringify(
      defaultPacket ?? {
        label: "BOS Packet",
        bos_index: 0.3,
        findings: [],
        insights: {},
        meta: { currency: "INR", unit: "actual" },
      },
      null,
      2
    )
  );

  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [out, setOut] = useState<EAResponse | null>(null);

  const outOfCredits = useMemo(() => walletBalance !== null && walletBalance <= 0, [walletBalance]);

  async function refreshWalletBestEffort() {
    try {
      const bal = await fetchWalletBalance(userId);
      onWalletUpdate?.(bal.balance_credits);
    } catch {
      // ignore; dashboard can show its own error state
    }
  }

  async function onRun() {
    setErr(null);
    setOut(null);

    if (outOfCredits) {
      setErr("Out of credits. Please top up or upgrade your plan.");
      return;
    }

    let packet: unknown;
    try {
      packet = JSON.parse(packetText);
    } catch (e: any) {
      setErr(`Invalid JSON: ${e?.message || String(e)}`);
      return;
    }

    setRunning(true);
    try {
      const resp = await runEA(packet, {
        userId,
        planTier,
        timeoutSec: 180,
        numPredict: 512,
      });

      setOut(resp);

      // refresh wallet after success
      await refreshWalletBestEffort();
    } catch (e: any) {
      const msg = e?.message || "BOS run failed";
      setErr(msg);

      // Heuristic: if backend indicates insufficient credits, update wallet to 0
      if (/out of credits|insufficient credits|payment required|402/i.test(msg)) {
        onWalletUpdate?.(0);
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className={`rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Run BOS</h2>
          <div className="text-xs opacity-70">
            Uses BOS Validator API · Tier: <span className="font-semibold">{planTier}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onRun}
          disabled={running || outOfCredits}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white shadow hover:bg-blue-500 disabled:opacity-60"
        >
          {running ? "Running…" : "Run"}
        </button>
      </div>

      <textarea
        value={packetText}
        onChange={(e) => setPacketText(e.currentTarget.value)}
        rows={12}
        spellCheck={false}
        className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 font-mono text-sm text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      />

      {err && (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {err}
        </div>
      )}

      {out && (
        <details open className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
          <summary className="cursor-pointer text-sm font-semibold opacity-90">Raw Output</summary>
          <pre className="mt-2 max-h-[420px] overflow-auto text-xs opacity-90">{pretty(out)}</pre>
        </details>
      )}
    </section>
  );
}
