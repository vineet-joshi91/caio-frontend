"use client";

import { useEffect, useState } from "react";

type CreditTransaction = {
  id: number;
  user_id: number;
  amount: number; // +credits or -credits
  reason: string;
  gateway?: string | null;
  created_at: string;
  extra_metadata?: Record<string, any> | null;
};

const BOS_API_BASE =
  process.env.NEXT_PUBLIC_VALIDATOR_API_BASE?.trim() ||
  "https://caioinsights.com/bos";

export function WalletLedger({
  userId,
  pageSize = 10,
  className = "",
}: {
  userId: number;
  pageSize?: number;
  className?: string;
}) {
  const [rows, setRows] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  async function loadPage(nextOffset = 0, append = false) {
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch(
        `${BOS_API_BASE}/wallet/transactions?user_id=${userId}&limit=${pageSize}&offset=${nextOffset}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data: CreditTransaction[] = await res.json();

      if (append) {
        setRows((prev) => [...prev, ...data]);
      } else {
        setRows(data);
      }

      setHasMore(data.length === pageSize);
      setOffset(nextOffset);
    } catch (e: any) {
      setErr(e?.message || "Failed to load wallet ledger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userId) {
      loadPage(0, false);
    }
  }, [userId]);

  function formatDate(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  }

  function amountBadge(amount: number) {
    if (amount > 0) {
      return (
        <span className="rounded-md bg-emerald-500/15 border border-emerald-400/40 px-2 py-0.5 text-emerald-200 text-xs">
          +{amount}
        </span>
      );
    }
    return (
      <span className="rounded-md bg-red-500/15 border border-red-400/40 px-2 py-0.5 text-red-200 text-xs">
        {amount}
      </span>
    );
  }

  return (
    <section
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl ${className}`}
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Credit Usage</h2>
        <span className="text-xs opacity-70">
          Ledger (most recent first)
        </span>
      </header>

      {loading && (
        <div className="text-sm opacity-70">Loading ledger…</div>
      )}

      {err && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {!loading && !err && rows.length === 0 && (
        <div className="text-sm opacity-70">
          No transactions yet.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase opacity-70">
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">Reason</th>
                <th className="py-2 pr-2">Gateway</th>
                <th className="py-2 pr-2 text-right">Credits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-800/60 hover:bg-zinc-800/30"
                >
                  <td className="py-2 pr-2">
                    {formatDate(r.created_at)}
                  </td>
                  <td className="py-2 pr-2">
                    <div className="font-medium">{r.reason}</div>
                    {r.extra_metadata && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs opacity-60 hover:opacity-90">
                          metadata
                        </summary>
                        <pre className="mt-1 max-h-40 overflow-auto rounded bg-zinc-950/60 p-2 text-xs">
                          {JSON.stringify(
                            r.extra_metadata,
                            null,
                            2
                          )}
                        </pre>
                      </details>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {r.gateway || "system"}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {amountBadge(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && !loading && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() =>
              loadPage(offset + pageSize, true)
            }
            className="rounded-lg border border-zinc-700 bg-zinc-950/40 px-4 py-1.5 text-xs hover:bg-zinc-800"
          >
            Load more
          </button>
        </div>
      )}
    </section>
  );
}
