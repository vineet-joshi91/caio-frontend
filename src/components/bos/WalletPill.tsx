"use client";

import React, { useMemo } from "react";
import Link from "next/link";

export function WalletPill({
  balance,
  loading,
  error,
  className = "",
  onRefresh,
  showUpgrade = true,
}: {
  balance: number | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
  onRefresh?: () => void;
  showUpgrade?: boolean;
}) {
  const state = useMemo(() => {
    if (loading) return "loading";
    if (error) return "error";
    if (balance === null) return "unknown";
    if (balance <= 0) return "empty";
    return "ok";
  }, [balance, loading, error]);

  const tone =
    state === "empty"
      ? "border-red-400/30 bg-red-500/10 text-red-100"
      : state === "error"
      ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
      : "border-zinc-800 bg-zinc-900/70 text-zinc-100";

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-xl ${tone} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs opacity-70">Credits</div>
          <div className="text-lg font-semibold leading-tight">
            {loading ? "…" : balance === null ? "—" : balance}
          </div>

          {state === "empty" && (
            <div className="mt-1 text-xs opacity-90">
              Out of credits — top up / upgrade required.
            </div>
          )}

          {state === "error" && (
            <div className="mt-1 text-xs opacity-90">
              {error || "Failed to load wallet."}
            </div>
          )}
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-zinc-700 bg-zinc-950/40 px-3 py-1.5 text-xs hover:bg-zinc-800"
            title="Refresh wallet"
          >
            Refresh
          </button>
        )}
      </div>

      {showUpgrade && state === "empty" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/payments"
            className="rounded-md bg-red-600 px-3 py-1 text-[13px] text-white hover:bg-red-500"
          >
            Upgrade / Top up
          </Link>
          <Link
            href="/trial/chat"
            className="rounded-md border border-zinc-600 px-3 py-1 text-[13px] hover:bg-zinc-800"
          >
            Try Chat
          </Link>
        </div>
      )}
    </div>
  );
}
