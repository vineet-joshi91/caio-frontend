"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { runEA, fetchWalletBalance, type EAResponse, type PlanTier } from "@/lib/validator";

// ---- Minimal local types (avoid legacy coupling) ----------------------

type Me = {
  id: number;
  email: string;
  tier?: string;
  is_admin?: boolean;
  is_paid?: boolean;
};

// If you still use old auth backend for /api/profile, keep NEXT_PUBLIC_API_BASE.
// Otherwise, replace this flow later with BOS-native auth.
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.trim().replace(/\/+$/, "") || "";

function getStoredToken(): string | null {
  try {
    return localStorage.getItem("caio_token");
  } catch {
    return null;
  }
}

async function fetchMe(token: string): Promise<Me> {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE is not configured");

  const res = await fetch(`${API_BASE}/api/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Me;
}

// ----------------------------------------------------------------------

const pretty = (v: unknown) =>
  typeof v === "string" ? v : JSON.stringify(v, null, 2);

export default function DashboardPage() {
  const router = useRouter();

  const [token, setToken] = useState<string>("");
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletErr, setWalletErr] = useState<string | null>(null);

  const [packetText, setPacketText] = useState<string>(() =>
    JSON.stringify(
      {
        label: "Dashboard Demo Packet",
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
  const [out, setOut] = useState<EAResponse | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);

  const redirectingRef = useRef(false);

  // ---- Load token + profile (legacy auth bridge) ----------------------

  useEffect(() => {
    const t = getStoredToken();
    if (!t) {
      router.replace("/login");
      return;
    }
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;

    (async () => {
      setBusy(true);
      setErr(null);

      try {
        const profile = await fetchMe(token);
        setMe(profile);

        // fetch wallet balance from BOS validator using user_id
        try {
          const bal = await fetchWalletBalance(profile.id);
          setWalletBalance(bal.balance_credits);
          setWalletErr(null);
        } catch (e: any) {
          setWalletBalance(null);
          setWalletErr(e?.message || "Failed to fetch wallet balance");
        }
      } catch (e: any) {
        setErr(e?.message || "Failed to load profile");
        if (!redirectingRef.current) {
          redirectingRef.current = true;
          router.replace("/login");
        }
      } finally {
        setBusy(false);
      }
    })();
  }, [token, router]);

  // ---- Tier mapping ---------------------------------------------------

  const planTier: PlanTier = useMemo(() => {
    const t = (me?.tier || "demo").toLowerCase();
    if (t === "premium") return "premium";
    if (t === "enterprise") return "enterprise";
    if (t === "pro") return "pro";
    return "demo";
  }, [me?.tier]);

  // ---- BOS run --------------------------------------------------------

  const canRun = useMemo(() => {
    if (walletBalance === null) return true; // unknown, allow attempt
    return walletBalance > 0;
  }, [walletBalance]);

  async function onRun() {
    setRunErr(null);
    setOut(null);

    let packet: unknown;
    try {
      packet = JSON.parse(packetText);
    } catch (e: any) {
      setRunErr(`Invalid JSON: ${e?.message || String(e)}`);
      return;
    }

    if (!me) {
      setRunErr("Profile not loaded yet.");
      return;
    }

    // hard stop if we know credits are zero
    if (walletBalance !== null && walletBalance <= 0) {
      setRunErr("Out of credits. Please top up or upgrade your plan.");
      return;
    }

    setRunning(true);
    try {
      const resp = await runEA(packet, {
        userId: me.id,
        planTier,
        timeoutSec: 120,
        numPredict: 512,
      });
      setOut(resp);

      // refresh wallet after run (best-effort)
      try {
        const bal = await fetchWalletBalance(me.id);
        setWalletBalance(bal.balance_credits);
      } catch {}
    } catch (e: any) {
      const msg = e?.message || "BOS run failed";
      setRunErr(msg);

      // if backend starts returning a specific out-of-credits message, catch it here
      if (/out of credits|insufficient credits|payment required|402/i.test(msg)) {
        setWalletBalance(0);
      }
    } finally {
      setRunning(false);
    }
  }

  // ---- Render ---------------------------------------------------------

  if (busy) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded border p-4">Loading dashboard…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded border border-red-500/40 bg-red-500/10 p-4">
          {err}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <div className="text-sm opacity-75">
            Signed in as <span className="font-medium">{me?.email}</span> · Tier{" "}
            <span className="font-medium">{planTier}</span>
          </div>
        </div>

        <div className="rounded border px-4 py-2">
          <div className="text-xs opacity-70">Credits</div>
          <div className="text-lg font-semibold">
            {walletBalance === null ? "—" : walletBalance}
          </div>
          {walletErr && <div className="text-xs text-red-400">{walletErr}</div>}
          {walletBalance !== null && walletBalance <= 0 && (
            <div className="mt-1 text-xs text-red-300">
              Out of credits — top up/upgrade required.
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 rounded border p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="font-medium">BOS Packet</span>
          <button
            onClick={onRun}
            disabled={running || !canRun}
            className="rounded bg-red-500 px-4 py-2 text-white disabled:opacity-60"
          >
            {running ? "Running…" : "Run BOS"}
          </button>
        </div>

        <textarea
          value={packetText}
          onChange={(e) => setPacketText(e.currentTarget.value)}
          rows={14}
          spellCheck={false}
          className="w-full resize-y rounded border bg-transparent p-2 font-mono text-sm"
        />

        {runErr && (
          <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm">
            {runErr}
          </div>
        )}
      </div>

      {out && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded border p-4">
            <div className="mb-2 text-sm opacity-70">Executive Summary</div>
            <div className="text-base">
              {out.ui?.executive_summary || out.ui?.summary || "—"}
            </div>
          </div>

          <div className="rounded border p-4">
            <div className="mb-2 text-sm opacity-70">Meta</div>
            <pre className="max-h-[240px] overflow-auto text-sm">
              {pretty(out.ui?._meta || {})}
            </pre>
          </div>

          <div className="rounded border p-4 md:col-span-2">
            <div className="mb-2 text-sm opacity-70">Raw Output</div>
            <pre className="max-h-[420px] overflow-auto text-sm">{pretty(out)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
