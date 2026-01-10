"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import LogoutButton from "@/components/LogoutButton";
import { WalletPill } from "@/components/bos/WalletPill";
import { WalletLedger } from "@/components/bos/WalletLedger";
import { BOSRunPanel } from "@/components/bos/BOSRunPanel";
import { BOSSummary } from "@/components/bos/BOSSummary";

import {
  fetchWalletBalance,
  type EAResponse,
  type PlanTier,
} from "@/lib/validator";

/* ---------------- Config ---------------- */

const BOS_BASE =
  process.env.NEXT_PUBLIC_BOS_BASE?.trim().replace(/\/+$/, "") ||
  "https://caioinsights.com";

const IDENTITY_BASE =
  process.env.NEXT_PUBLIC_IDENTITY_BASE?.trim().replace(/\/+$/, "") ||
  BOS_BASE;

const BUILD_ID = "caio-bos-dashboard-v2";

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
    console.log("CAIO Dashboard build:", BUILD_ID);

    const t = readTokenSafe();
    setToken(t);

    if (!t) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${IDENTITY_BASE}/me`, {
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
      } catch {
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
      setWalletErr(e?.message || "Failed to fetch wallet balance");
    }
  }

  useEffect(() => {
    if (me?.id) {
      refreshWallet(me.id);
    }
  }, [me?.id]);

  /* ---------------- Derived ---------------- */

  // BOS logic: wallet > tier; keep tier simple; backend enforces credits anyway
  const planTier: PlanTier = me?.is_admin ? "enterprise" : "demo";

  /* ---------------- Redirect UI ---------------- */

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

  /* ---------------- Not logged in gate ---------------- */

  if (!loading && !me) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
            <h1 className="text-2xl font-semibold">Decision Review</h1>
            <p className="mt-2 text-sm opacity-80">
              Your session has expired or you’re not logged in.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white shadow hover:bg-blue-500"
              >
                Log in
              </button>

              <button
                type="button"
                onClick={() => router.push("/signup?plan=demo")}
                className="rounded-xl border border-zinc-700 bg-zinc-950/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                Start Guided Trial
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ---------------- Main UI ---------------- */

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ---------------- Header ---------------- */}
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Decision Review</h1>
              <p className="mt-1 text-sm opacity-80">
                {me ? (
                  <>
                    Signed in as <b>{me.email}</b>
                  </>
                ) : (
                  <>Session required</>
                )}
              </p>
              <p className="mt-2 text-sm opacity-70">
                Upload a real business file and get a unified executive action plan — rule-grounded, not chatbot replies.
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

        {/* ---------------- Wallet Ledger ---------------- */}
        {me?.id && <WalletLedger userId={me.id} className="mt-2" />}

        {/* ---------------- Credits warning ---------------- */}
        {me && walletBalance !== null && walletBalance <= 0 && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            You’re out of credits. Top up to run more decision reviews.
          </div>
        )}

        {/* ---------------- Run BOS ---------------- */}
        {me && (
          <BOSRunPanel
            userId={me.id}
            planTier={planTier}
            walletBalance={walletBalance}
            onWalletUpdate={(b) => setWalletBalance(b)}
            onRunComplete={(resp) => setLastRun(resp)}
            className="mt-4"
          />
        )}

        {/* ---------------- Output ---------------- */}
        {lastRun?.ui && <BOSSummary ui={lastRun.ui} title="Executive Action Plan" />}

        {/* ---------------- Loading overlay ---------------- */}
        {loading && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            Loading…
          </div>
        )}
      </div>
    </main>
  );
}
