"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import LogoutButton from "@/components/LogoutButton";
import { WalletPill } from "@/components/bos/WalletPill";
import { WalletLedger } from "@/components/bos/WalletLedger";
import { BOSUploadPanel } from "@/components/bos/BOSUploadPanel";
import { BOSSummary } from "@/components/bos/BOSSummary";

import { fetchWalletBalance, type EAResponse, type PlanTier } from "@/lib/validator";

/* ---------------- Config ---------------- */

const BOS_BASE =
  process.env.NEXT_PUBLIC_BOS_BASE?.trim().replace(/\/+$/, "") ||
  "https://caioinsights.com";

const IDENTITY_BASE =
  process.env.NEXT_PUBLIC_IDENTITY_BASE?.trim().replace(/\/+$/, "") ||
  "https://caioinsights.com";

const BUILD_ID = "caio-bos-dashboard-v4-ui-clean";

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

function normalizeTier(raw?: string, isAdmin?: boolean): "standard" | "premium" {
  if (isAdmin) return "premium";
  const t = (raw || "").toLowerCase().trim();
  if (t === "premium" || t === "pro" || t === "enterprise") return "premium";
  return "standard";
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

  const [executionPlan, setExecutionPlan] = useState<EAResponse | null>(null);
  const [decisionReview, setDecisionReview] = useState<EAResponse | null>(null);

  const [decisionReviewBusy, setDecisionReviewBusy] = useState(false);
  const [decisionReviewErr, setDecisionReviewErr] = useState<string | null>(null);

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
        const res = await fetch(`${IDENTITY_BASE}/bos-auth/me`, {
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
    if (me?.id) refreshWallet(me.id);
  }, [me?.id]);

  /* ---------------- Derived ---------------- */

  const userTier = normalizeTier(me?.tier, !!me?.is_admin);
  const canDecisionReview = userTier === "premium";

  /* ---------------- Decision Review ---------------- */

  async function runDecisionReviewFromPlan() {
    if (!me?.id) return;

    if (!canDecisionReview) {
      setDecisionReviewErr("Decision Review is a Premium feature. Upgrade to unlock it.");
      return;
    }

    setDecisionReviewErr(null);

    const tok = readTokenSafe();
    if (!tok) {
      router.push("/login");
      return;
    }

    const planObj = (executionPlan as any)?.ui;
    if (!planObj || typeof planObj.executive_summary !== "string") {
      setDecisionReviewErr("No Executive Action Plan available. Please run Upload & Analyze first.");
      return;
    }

    setDecisionReviewBusy(true);
    try {
      const packet = {
        label: "Decision Review Input",
        source: { type: "execution_plan" },
        document_text: JSON.stringify(planObj, null, 2),
        meta: { mode: "decision_review_from_plan" },
      };

      const res = await fetch(`${BOS_BASE}/run-ea`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tok}`,
        },
        body: JSON.stringify({
          packet,
          user_id: me.id,
          plan_tier: userTier,
          timeout_sec: 600,
          num_predict: 768,
          model: "qwen2.5:3b-instruct",
        }),
      });

      const raw = await res.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg = data?.detail || data?.message || raw || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const ui = data?.ui ?? data;
      if (!ui) throw new Error("Decision Review returned empty response");

      setDecisionReview({ ui } as any);

      // Refresh balance after DR runs
      if (me?.id) refreshWallet(me.id);

    } catch (e: any) {
      setDecisionReviewErr(e?.message || "Decision Review failed");
    } finally {
      setDecisionReviewBusy(false);
    }
  }

  /* ---------------- Redirect UI ---------------- */

  if (redirecting.current) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            Redirecting...
          </div>
        </div>
      </main>
    );
  }

  if (!loading && !me) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
            <h1 className="text-2xl font-semibold">CAIO</h1>
            <p className="mt-2 text-sm opacity-80">
              Your session has expired or you are not logged in.
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

        {/* Header */}
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">CAIO's Insights</h1>
              <p className="mt-1 text-sm opacity-80">
                Signed in as <b>{me?.email}</b>
              </p>
              <p className="mt-2 text-sm opacity-70">
                Upload a real business file and get a unified executive action plan - rule-grounded, not chatbot replies.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {me?.is_admin && (
                <button
                  type="button"
                  onClick={() => router.push("/admin")}
                  className="rounded-xl border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
                >
                  Admin Mode
                </button>
              )}
              {token && <LogoutButton />}
            </div>
          </div>
        </header>

        {/* Credits / Wallet */}
        <div className="relative">
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
              <span>Credits</span>
              <span className="text-xs opacity-60">(usage & balance)</span>
            </summary>

            <div className="mt-3 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <WalletPill
                balance={walletBalance}
                loading={walletBalance === null && !walletErr}
                error={walletErr}
                onRefresh={() => me?.id && refreshWallet(me.id)}
              />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => me?.id && refreshWallet(me.id)}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
                >
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/payments")}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
                >
                  Add credits
                </button>
              </div>

              {walletErr && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-100">
                  Credits unavailable. Try refreshing or re-login.
                </div>
              )}

              {me?.id && (
                <details className="group">
                  <summary className="cursor-pointer text-xs opacity-60 hover:opacity-90">
                    View credit usage
                  </summary>
                  <WalletLedger userId={me.id} className="mt-2" />
                </details>
              )}
            </div>
          </details>
        </div>

        {/* Upload */}
        {me && (
          <BOSUploadPanel
            planTier={userTier}
            onRunComplete={(resp) => {
              const ui = (resp as any)?.ui ?? resp;

              if (!ui || typeof ui !== "object" || typeof (ui as any).executive_summary !== "string") {
                console.error("EA normalize failed: unexpected response shape", resp);
                setExecutionPlan(null);
                setDecisionReview(null);
                setDecisionReviewErr("Failed to detect an Executive Action Plan. Please try again.");
                return;
              }

              setExecutionPlan({ ui } as any);
              setDecisionReview(null);
              setDecisionReviewErr(null);

              // Refresh balance after upload
              if (me?.id) refreshWallet(me.id);
            }}
          />
        )}

        {/* Execution Plan output */}
        {executionPlan?.ui && (
          <BOSSummary ui={executionPlan.ui} title="Executive Action Plan" showDiagnostics={false} />
        )}

        {/* Decision Review */}
        {executionPlan?.ui && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Decision Review</div>
                <div className="text-xs opacity-70">
                  Audit the Executive Action Plan for gaps, missing evidence, risks, and owner accountability.
                </div>

                {!canDecisionReview && (
                  <div className="mt-2 text-xs text-amber-400">
                    Upgrade to Premium to unlock Decision Review.
                  </div>
                )}

                {decisionReviewBusy && (
                  <div className="mt-2 text-xs opacity-70">
                    Reviewing the plan...
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={runDecisionReviewFromPlan}
                disabled={decisionReviewBusy || !canDecisionReview}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {decisionReviewBusy && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {decisionReviewBusy
                  ? "Reviewing..."
                  : canDecisionReview
                  ? "Review this plan"
                  : "Premium only"}
              </button>
            </div>

            {decisionReviewErr && (
              <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                {decisionReviewErr}
              </div>
            )}
          </div>
        )}

        {/* Decision Review output */}
        {decisionReview?.ui && (
          <BOSSummary ui={decisionReview.ui} title="Decision Review" showDiagnostics={false} />
        )}

        {loading && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            Loading...
          </div>
        )}

      </div>
    </main>
  );
}