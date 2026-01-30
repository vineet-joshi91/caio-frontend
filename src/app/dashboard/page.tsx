"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import LogoutButton from "@/components/LogoutButton";
import { WalletPill } from "@/components/bos/WalletPill";
import { WalletLedger } from "@/components/bos/WalletLedger";
import { BOSUploadPanel } from "@/components/bos/BOSUploadPanel";
import { BOSRunPanel } from "@/components/bos/BOSRunPanel";
import { BOSSummary } from "@/components/bos/BOSSummary";

import {
  fetchWalletBalance,
  type EAResponse,
  type PlanTier,
} from "@/lib/validator";

function extractEAFromStdout(stdout?: string) {
  if (!stdout) return null;

  // collect all '{' positions
  const starts: number[] = [];
  for (let i = 0; i < stdout.length; i++) {
    if (stdout[i] === "{") starts.push(i);
  }
  if (starts.length === 0) return null;

  // try from the end: last complete JSON object wins
  for (let s = starts.length - 1; s >= 0; s--) {
    const start = starts[s];
    let depth = 0;
    let inStr = false;
    let esc = false;

    for (let i = start; i < stdout.length; i++) {
      const ch = stdout[i];

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
            const candidate = stdout.slice(start, i + 1);
            try {
              const obj = JSON.parse(candidate);
              if (
                obj &&
                typeof obj === "object" &&
                typeof obj.executive_summary === "string" &&
                Array.isArray(obj.top_priorities) &&
                obj.owner_matrix
              ) {

                return obj; // only accept EA-like objects
              }
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


/* ---------------- Config ---------------- */

const BOS_BASE =
  process.env.NEXT_PUBLIC_BOS_BASE?.trim().replace(/\/+$/, "") ||
  "https://caioinsights.com";

const IDENTITY_BASE =
  process.env.NEXT_PUBLIC_IDENTITY_BASE?.trim().replace(/\/+$/, "") ||
  "https://caioinsights.com";

const BUILD_ID = "caio-bos-dashboard-v3-execplan-decisionreview";

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

  // ✅ Two separate outputs
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
        // ✅ must use bos-auth/me (not /me) because /me hits static site
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
    if (me?.id) {
      refreshWallet(me.id);
    }
  }, [me?.id]);

  /* ---------------- Derived ---------------- */

  const planTier: PlanTier = me?.is_admin ? "enterprise" : "demo";

  /* ---------------- Decision Review runner (from plan) ---------------- */

  async function runDecisionReviewFromPlan() {
    if (!me?.id) return;

    setDecisionReviewErr(null);

    const tok = readTokenSafe();
    if (!tok) {
      router.push("/login");
      return;
    }

    // IMPORTANT: executionPlan may be either:
    // 1) { ui: <plan> }  OR
    // 2) <plan> directly (depending on earlier parsing)
    const planObj = (executionPlan as any)?.ui ?? (executionPlan as any);

    if (!planObj || !planObj.executive_summary) {
      setDecisionReviewErr(
        "No Executive Action Plan available to review. Please run Upload & Analyze first."
      );
      return;
    }

    setDecisionReviewBusy(true);
    try {
      // Convert the plan to a document_text packet (satisfies backend guard)
      const packet = {
        label: "Decision Review Input",
        source: { type: "execution_plan" },
        document_text: JSON.stringify(planObj, null, 2),
        meta: { mode: "decision_review_from_plan" },
      };

      console.log("DECISION_REVIEW_BUILD_MARKER v2: using qwen3b + num_predict 123");

      const res = await fetch(`${BOS_BASE}/run-ea`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tok}`,
        },
        body: JSON.stringify({
          packet,
          user_id: me.id,
          plan_tier: planTier,
          timeout_sec: 600,
          num_predict: 768,              // faster; increase later if needed
          model: "qwen2.5:3b-instruct",  // phi3:mini will fail on your RAM
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
        const msg =
          data?.detail ||
          data?.message ||
          raw ||
          `HTTP ${res.status}`;
        throw new Error(msg);
      }

      // Normalize output shape
      const ui = data?.ui ?? data;
      if (!ui) {
        throw new Error("Decision Review returned empty response");
      }

      setDecisionReview({ ui } as any);
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
            Redirecting…
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

        {/* Header */}
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Decision Review</h1>
              <p className="mt-1 text-sm opacity-80">
                Signed in as <b>{me?.email}</b>
              </p>
              <p className="mt-2 text-sm opacity-70">
                Upload a real business file and get a unified executive action plan — rule-grounded, not chatbot replies.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {me?.is_admin && (
                <>
                  <span className="rounded-full border border-purple-400/40 bg-purple-500/15 px-3 py-1 text-xs text-purple-200">
                    Admin
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push("/admin")}
                    className="rounded-xl border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
                  >
                    Admin Mode
                  </button>
                </>
              )}
              {token && <LogoutButton />}
            </div>
          </div>
        </header>

        {/* Wallet */}
        <WalletPill
          balance={walletBalance}
          loading={walletBalance === null && !walletErr}
          error={walletErr}
          onRefresh={() => me?.id && refreshWallet(me.id)}
        />

        {/* Credits actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => me?.id && refreshWallet(me.id)}
            className="rounded-xl border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Refresh credits
          </button>

          <button
            type="button"
            onClick={() => router.push("/payments")}
            className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white shadow hover:bg-blue-500"
          >
            Top up credits
          </button>

          <span className="text-xs opacity-60">
            Credits control usage (pay-as-you-go). No subscriptions.
          </span>
        </div>

        {walletErr && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            <div className="font-semibold mb-1">Credits unavailable</div>
            <div className="opacity-90">
              We couldn’t load your credit balance right now. Try refresh. If it persists, log out and log in again.
            </div>
          </div>
        )}

        {/* Ledger */}
        {me?.id && <WalletLedger userId={me.id} className="mt-2" />}

        {/* Upload (Execution plan source) */}
        {me && (
          <BOSUploadPanel
            planTier={planTier}
            onRunComplete={(resp) => {
              // Case 1: backend returned EA directly (future-proof)
              if ((resp as any)?.executive_summary) {
                setExecutionPlan({ ui: resp } as any);
              } else {
                // Case 2: current backend → EA is inside ui.stdout
                const parsed = extractEAFromStdout((resp as any)?.ui?.stdout);

                if (!parsed) {
                  console.error("Failed to parse EA from response", resp);
                  setDecisionReviewErr("Failed to parse Executive Action Plan");
                  return;
                }

                setExecutionPlan({ ui: parsed } as any);
              }

              // reset decision review when a new plan is generated
              setDecisionReview(null);
              setDecisionReviewErr(null);
            }}

            className="mt-4"
          />
        )}

        {/* Execution Plan output */}
        {executionPlan?.ui && (
          <BOSSummary ui={executionPlan.ui} title="Executive Action Plan" />
        )}

        {/* Decision Review trigger (from plan) */}
        {executionPlan?.ui && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Decision Review</div>
                <div className="text-xs opacity-70">
                  Audit the Executive Action Plan for gaps, missing evidence, risks, and owner accountability.
                </div>
              </div>

              <button
                type="button"
                onClick={runDecisionReviewFromPlan}
                disabled={decisionReviewBusy}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {decisionReviewBusy ? "Reviewing…" : "Review this plan"}
              </button>
            </div>

            {decisionReviewErr && (
              <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                {decisionReviewErr}
              </div>
            )}
          </div>
        )}

        {/* Decision Review output (separate, never overwrites exec plan) */}
        {decisionReview?.ui && (
          <BOSSummary ui={decisionReview.ui} title="Decision Review" />
        )}

        {/* Admin-only advanced manual runner (kept, but not default) */}
        {me?.is_admin && (
          <details className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <summary className="cursor-pointer text-sm font-semibold opacity-90">
              Advanced (Admin): Manual Decision Review runner
            </summary>

            <div className="mt-3 text-xs opacity-70">
              This is for testing validator packets directly. Most users should use “Review this plan”.
            </div>

            <BOSRunPanel
              userId={me.id}
              planTier={planTier}
              walletBalance={walletBalance}
              onWalletUpdate={(b) => setWalletBalance(b)}
              onRunComplete={(resp) => setDecisionReview(resp)}
              className="mt-3"
            />
          </details>
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
