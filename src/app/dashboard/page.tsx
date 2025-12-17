"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import LogoutButton from "@/components/LogoutButton";
import { WalletPill } from "@/components/bos/WalletPill";
import { BOSRunPanel } from "@/components/bos/BOSRunPanel";
import { BOSSummary } from "@/components/bos/BOSSummary";

import {
  fetchWalletBalance,
  type EAResponse,
  type PlanTier,
} from "@/lib/validator";

/* ---------------- Config ---------------- */

// Identity provider (TEMPORARY – Option A)
const IDENTITY_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.trim() ||
  "https://caio-orchestrator.onrender.com";

// BOS backend
const BOS_API_BASE =
  process.env.NEXT_PUBLIC_VALIDATOR_API_BASE?.trim() ||
  "https://caioinsights.com/bos";

// bump when needed to bust caches
const BUILD_ID = "caio-bos-dashboard-v1";

/* ---------------- Types ---------------- */

type Me = {
  id: number;
  email: string;
  is_admin?: boolean;
  tier?: string;
};

/* ---------------- Utils ---------------- */

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

/* ---------------- Page ---------------- */

export default function DashboardPage() {
  const router = useRouter();
  const redirecting = useRef(false);

  const [token, setToken] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletErr, setWalletErr] = useState<string | null>(null);

  const [lastRun, setLastRun] = useState<EAResponse | null>(null);

  /* ---------------- Boot ---------------- */

  useEffect(() => {
    console.log("CAIO BOS Dashboard build:", BUILD_ID);

    const t = readTokenSafe();
    setToken(t);

    if (!t) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${IDENTITY_API_BASE}/api/profile`, {
          headers: { Authorization: `Bearer ${t}` },
          cache: "no-store",
        });

        if (res.status === 401) throw new Error("unauthorized");
        if (!res.ok) throw new Error(await res.text());

        const j = await res.json();

        setMe({
          id: j.id,
          email: j.email,
          is_admin: !!j.is_admin,
          tier: j.tier,
        });
      } catch (e) {
        try {
          localStorage.removeItem("access_token");
          localStorage.removeItem("token");
        } catch {}
        if (!redirecting.current) {
          redirecting.current = true;
          router.replace("/login");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  /* ---------------- Wallet ---------------- */

  async function refreshWallet(userId: number) {
    try {
      setWalletErr(null);
      const bal = await fetchWalletBalance(userId);
      setWalletBalance(bal.balance_credits);
    } catch (e: any) {
      setWalletErr(
        e?.message || "Failed to fetch wallet balance"
      );
    }
  }

  useEffect(() => {
    if (me?.id) {
      refreshWallet(me.id);
    }
  }, [me?.id]);

  /* ---------------- Derived ---------------- */

  // BOS does NOT care about marketing tiers
  const planTier: PlanTier = me?.is_admin
    ? "enterprise"
    : "demo"; // demo by default; wallet governs real usage

  if (redirecting.current) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            Redirecting…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ---------------- Header ---------------- */}
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">
                CAIO Dashboard
              </h1>
              <p className="mt-1 text-sm opacity-80">
                {me
                  ? <>Logged in as <b>{me.email}</b></>
                  : <>Not logged in</>}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {me?.is_admin && (
                <span className="rounded-full border border-purple-400/40 bg-purple-500/15 px-3 py-1 text-xs text-purple-200">
                  Admin
                </span>
              )}
              {token && <LogoutButton />}
            </div>
          </div>
        </header>

        {/* ---------------- Wallet ---------------- */}
        <WalletPill
          balance={walletBalance}
          loading={walletBalance === null && !walletErr}
          error={walletErr}
          onRefresh={() => me?.id && refreshWallet(me.id)}
        />

        {/* ---------------- Run BOS ---------------- */}
        {me && (
          <BOSRunPanel
            userId={me.id}
            planTier={planTier}
            walletBalance={walletBalance}
            onWalletUpdate={(b) => setWalletBalance(b)}
            className="mt-2"
          />
        )}

        {/* ---------------- Output ---------------- */}
        {lastRun?.ui && (
          <BOSSummary
            ui={lastRun.ui}
            title="BOS Executive Summary"
          />
        )}

        {loading && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            Loading…
          </div>
        )}
      </div>
    </main>
  );
}
