"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import LogoutButton from "@/components/LogoutButton";
import {
  runEA as runEAValidator,
  type PlanTier,
  fetchWalletBalance,
} from "@/lib/validator";

// NEW: overlay
import AnalyzingOverlay from "@/components/AnalyzingOverlay";

// NEW: BOS visual components
import { EAOverview } from "@/components/EAOverview";
import { BrainPanel } from "@/components/brains/BrainPanel";
import type { BrainId } from "@/types/caio";

/* ---------------- Config ---------------- */
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.trim().replace(/\/+$/, "")) ||
  "http://localhost:8000";

// bump when you redeploy to be sure caches are busted
const BUILD_ID = "dash-v2.2-bos-validator-wallet";

/* ---------------- Shared Banner Component ---------------- */
/**
 * NoticeBanner
 * Reusable soft-status banner for timeouts, rate limit, etc.
 * tone:
 *  - "info"    = guidance / capability note (blue)
 *  - "warn"    = temporary issue / retry (amber)
 *  - "limit"   = plan ceiling (fuchsia)
 *  - "neutral" = auth/session/etc. (gray)
 */
function NoticeBanner({
  tone = "warn",
  title,
  body,
  children,
}: {
  tone?: "info" | "warn" | "limit" | "neutral";
  title: string;
  body?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const toneClasses: Record<"info" | "warn" | "limit" | "neutral", string> = {
    info: "border-blue-400/30 bg-blue-500/10 text-blue-100",
    warn: "border-amber-400/30 bg-amber-500/10 text-amber-100",
    limit: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100",
    neutral: "border-zinc-600/50 bg-zinc-800/60 text-zinc-200",
  };

  return (
    <div
      className={
        "rounded-xl border p-4 text-sm leading-relaxed " + toneClasses[tone]
      }
    >
      <div className="font-semibold text-[14px]">{title}</div>
      {body && <div className="mt-1 text-[13px] opacity-90">{body}</div>}
      {children && (
        <div className="mt-3 flex flex-wrap gap-2">{children}</div>
      )}
    </div>
  );
}

/* ---------------- Types ---------------- */
type Tier = "admin" | "premium" | "pro_plus" | "pro" | "demo";

type Me = {
  id: number; // needed for validator user_id
  email: string;
  is_admin?: boolean;
  is_paid?: boolean;
  created_at?: string;
  tier?: Tier;
};

type CombinedJSON = {
  aggregate?: {
    collective?: string[];
    collective_insights?: string[];
    recommendations_by_role?: Record<string, string[]>;
    cxo_recommendations?: Record<string, string[]>;
  };
  details_by_role?: Record<
    "CFO" | "CHRO" | "COO" | "CMO" | "CPO" | string,
    {
      summary?: string | null;
      recommendations?: string[];
      raw?: string | null;
    }
  >;
  overall_summary?: string;
  document_filename?: string | null;
  insights?: any[];
};

// NOTE: we allow arbitrary extra fields (including ui, per_brain)
// via the index signature in the "ok" / "demo" branches.
type Result =
  | {
      status: "demo";
      title?: string;
      summary?: string;
      combined?: CombinedJSON;
      tip?: string;
      [k: string]: any;
    }
  | {
      status: "error";
      title?: string;
      message: string;
      action?: string;
    }
  | {
      status: "ok";
      title?: string;
      summary?: string;
      combined?: CombinedJSON;
      [k: string]: any;
    };

type LimitInfo =
  | {
      plan?: string;
      used?: number;
      limit?: number;
      remaining?: number;
      reset_at?: string;
      title?: string;
      message?: string;
    }
  | null;

/* ---------------- Small utils ---------------- */
function readTokenSafe(): string {
  try {
    const ls =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      "";
    if (ls) return ls;
    const m = document.cookie.match(/(?:^|;)\s*token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

function withTimeout<T>(p: Promise<T>, ms = 120000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`Request timed out after ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function ensureBackendReady(): Promise<void> {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE is not set.");
  const url = `${API_BASE}/api/ready`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(to);
    if (!r.ok) throw new Error(`ready ${r.status}`);
  } catch {
    clearTimeout(to);
    // retry a couple of times in case backend spun down
    for (let i = 0; i < 2; i++) {
      await new Promise((res) => setTimeout(res, 1000 + 600 * i));
      try {
        const r2 = await fetch(url, { cache: "no-store" });
        if (r2.ok) return;
      } catch {
        /* ignore */
      }
    }
  }
}

// Map CAIO tiers → validator plan_tier
function mapTierToPlanTier(tier?: Tier, isAdmin?: boolean): PlanTier {
  if (isAdmin) return "pro"; // admins act like power users
  if (!tier || tier === "demo") return "demo";
  if (tier === "premium") return "premium";
  // pro & pro_plus
  return "pro";
}

/* ---------------- Markdown helpers (fallback only) ---------------- */
function normalizeAnalysis(md: string) {
  let s = (md ?? "").trim();
  if (!s) return "";
  s = s.replace(/\r\n/g, "\n");
  return s;
}

function parseBrains(md: string) {
  const lines = md.split("\n");
  const brains: {
    role: string;
    title: string;
    insights: string;
  }[] = [];
  let current: { role: string; title: string; insights: string } | null = null;
  for (const line of lines) {
    const m = line.match(/^#{2,3}\s*(CFO|CHRO|COO|CMO|CPO)\b/i);
    if (m) {
      if (current) brains.push(current);
      current = {
        role: m[1].toUpperCase(),
        title: line.replace(/^#{2,3}\s*/, ""),
        insights: "",
      };
    } else if (current) {
      current.insights += line + "\n";
    }
  }
  if (current) brains.push(current);
  return brains;
}

function extractListItems(text: string): string[] {
  if (!text) return [];
  const cleaned = text.replace(
    /^[\s\S]*?(?=^\s*(?:\d+[.)]|[-*•])\s)/m,
    "",
  );
  const parts = cleaned.split(/\n(?=\s*(?:\d+[.)]|[-*•])\s)/g);
  return parts
    .map((p) =>
      p
        .replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "")
        .trim(),
    )
    .filter(Boolean);
}

function InlineMD({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: (props) => <span {...props} />,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

/* ---------------- Page ---------------- */
export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const redirectingRef = useRef(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    console.log("CAIO Dashboard build:", BUILD_ID);
    const t = readTokenSafe();
    setToken(t);
    if (!t) {
      setBusy(false);
      return;
    }

    (async () => {
      try {
        await ensureBackendReady();
      } catch {
        /* non-fatal; profile call will still run */
      }

      try {
        const res = await withTimeout(
          fetch(`${API_BASE}/api/profile`, {
            headers: {
              Authorization: `Bearer ${t}`,
            },
            cache: "no-store",
          }),
          20000,
        );
        if (res.status === 401) {
          setErr("Invalid token");
          return;
        }
        if (!res.ok) throw new Error(await res.text());

        const j = await res.json();

        setMe({
          id: j.id ?? 0,
          email: j.email,
          is_admin: !!j.is_admin,
          is_paid: !!j.is_paid,
          created_at: j.created_at,
          tier: (j.tier as Tier) || "demo",
        });

        // fetch wallet credits after profile loads
        try {
          const bal = await fetchWalletBalance(j.id ?? 0);
          setWalletBalance(bal.balance_credits);
        } catch (e) {
          console.warn("Failed to fetch wallet balance:", e);
          setWalletBalance(0);
        }
      } catch (e: any) {
        setErr(
          e?.message || "Couldn’t load your profile. Please log in again.",
        );
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  // Kick to /login when token is invalid/expired
  useEffect(() => {
    if (!err) return;
    const msg = String(err).toLowerCase();
    if (
      msg.includes("invalid token") ||
      msg.includes('"detail":"invalid token"') ||
      msg.includes("unauthorized") ||
      msg.includes("401")
    ) {
      try {
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");
        document.cookie = "token=; Max-Age=0; path=/;";
      } catch {
        /* ignore */
      }
      if (!redirectingRef.current) {
        redirectingRef.current = true;
        router.replace("/login");
      }
    }
  }, [err, router]);

  // Admins act like Premium
  const effectiveTier: Tier | undefined = me?.is_admin ? "premium" : me?.tier;

  // Redirect premium / pro_plus / admin users to premium chat
  useEffect(() => {
    if (!token || !me) return;
    if (redirectingRef.current) return;
    if (
      me.is_admin ||
      effectiveTier === "premium" ||
      effectiveTier === "pro_plus"
    ) {
      redirectingRef.current = true;
      router.replace("/premium/chat");
    }
  }, [token, me, effectiveTier, router]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold">
              CAIO Dashboard
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Upload a key business document or paste a brief. CAIO will scan it
              like a cross-functional CXO team and highlight what matters.
            </p>

            {me && (
              <p className="mt-2 text-xs text-zinc-500">
                Logged in as{" "}
                <span className="text-zinc-200 font-mono">{me.email}</span>,{" "}
                <span className="uppercase tracking-wide">
                  {effectiveTier || "demo"}
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {me && walletBalance !== null && (
              <div className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900/50 text-xs text-zinc-300">
                Credits:{" "}
                <span className="font-semibold">{walletBalance}</span>
              </div>
            )}

            {me ? (
              <>
                {me.is_admin && (
                  <Link
                    href="/admin"
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm shadow"
                  >
                    Admin Mode
                  </Link>
                )}
                <LogoutButton />
              </>
            ) : (
              <Link
                href="/signup"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white"
              >
                Go to Login
              </Link>
            )}
          </div>
        </header>

        {/* CTA row for Demo & Pro */}
        {token && (effectiveTier === "demo" || effectiveTier === "pro") && (
          <div className="mt-3 flex items-center gap-3">
            {effectiveTier === "demo" && !me?.is_paid && (
              <Link
                href="/payments"
                className="inline-block text-blue-300 underline hover:text-blue-200"
              >
                Upgrade to Pro
              </Link>
            )}
            <Link
              href="/trial/chat"
              className="inline-flex items-center rounded-md bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-sm"
              title="Preview the premium chat experience"
            >
              Try Chat
            </Link>
          </div>
        )}

        {/* Tiny hint while redirecting */}
        {token &&
          (me?.is_admin ||
            effectiveTier === "premium" ||
            effectiveTier === "pro_plus") && (
            <div className="mt-2 text-xs opacity-70">
              Redirecting to Premium Chat…
            </div>
          )}

        {/* Demo/Pro dashboard only; higher tiers are redirected */}
        {!busy &&
          !err &&
          !(me?.is_admin ||
            effectiveTier === "premium" ||
            effectiveTier === "pro_plus") && (
            <AnalyzeCard
              token={token}
              tier={(effectiveTier || "demo") as Tier}
              me={me}
              onWalletUpdate={(bal) => setWalletBalance(bal)}
            />
          )}

        {busy && token && (
          <div className="bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800 mt-6">
            <div className="animate-pulse opacity-80">Loading…</div>
          </div>
        )}
        {err && (
          <div className="bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800 mt-6">
            <p className="text-red-300">{err}</p>
          </div>
        )}
      </div>
    </main>
  );
}

/* ---------------- Analyze card (Demo/Pro only) ---------------- */

function AnalyzeCard({
  token,
  tier,
  me,
  onWalletUpdate,
}: {
  token: string;
  tier: Tier;
  me: Me | null;
  onWalletUpdate?: (balance: number) => void;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // busy = backend in flight
  const [busy, setBusy] = useState(false);

  // analyzing = controls cinematic overlay
  const [analyzing, setAnalyzing] = useState(false);

  const [result, setResult] = useState<Result | null>(null);

  // friendlyErr is now a category token:
  // "timeout" | "auth" | "network" | "nocredits" | null
  const [friendlyErr, setFriendlyErr] =
    useState<"timeout" | "auth" | "network" | "nocredits" | null>(null);

  const [limit, setLimit] = useState<LimitInfo>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  function onBrowseClick() {
    fileInputRef.current?.click();
  }
  function onFileChosen(f: File | undefined | null) {
    if (f) setFile(f);
  }

  function resetErrors() {
    setFriendlyErr(null);
    setLimit(null);
    setResult(null);
  }

  function formatUtcShort(iso?: string) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      return `${hh}:${mm} UTC`;
    } catch {
      return "";
    }
  }

  async function run() {
    setBusy(true);
    setAnalyzing(true); // show overlay immediately
    resetErrors();

    try {
      if (!text.trim() && !file)
        throw new Error("Enter a brief or upload a file to analyze.");

      // We still ping the core backend to keep it warm (for profile, etc.)
      await ensureBackendReady();

      // BRANCH 1: file present → use legacy /api/analyze pipeline
      if (file) {
        const fd = new FormData();
        if (text.trim()) fd.append("text", text.trim());
        fd.append("file", file);
        fd.append("brains", "CFO,CHRO,COO,CMO,CPO");

        const res = await withTimeout(
          fetch(`${API_BASE}/api/analyze`, {
            method: "POST",
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : undefined,
            body: fd,
          }),
          120000,
        );

        const raw = await res.text();
        let parsed: any = {};
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          parsed = {};
        }

        if (res.status === 429) {
          setLimit({
            plan: parsed?.plan,
            used: parsed?.used,
            limit: parsed?.limit,
            remaining: parsed?.remaining,
            reset_at: parsed?.reset_at,
            title: parsed?.title || "Daily limit reached",
            message: parsed?.message || "You’ve hit today’s usage limit.",
          });
          return;
        }

        if (res.status === 401) {
          setFriendlyErr("auth");
          return;
        }
        if (res.status === 413) {
          // file too large for plan
          setFriendlyErr("network"); // treat with generic guidance
          setResult({
            status: "error",
            title: "This file is a bit too heavy",
            message:
              "That upload is over the size allowed on this plan. You can try a smaller file or upgrade for larger uploads.",
          });
          return;
        }
        if (res.status === 415) {
          setFriendlyErr("network");
          setResult({
            status: "error",
            title: "This file type isn’t supported yet",
            message:
              "Right now CAIO accepts PDF, Word, Excel, PowerPoint, and plain text. You can convert this file to a supported format and try again.",
          });
          return;
        }

        if (!res.ok) {
          setFriendlyErr("network");
          setResult({
            status: "error",
            title: parsed?.title || "We couldn’t finish that run",
            message:
              parsed?.message ||
              "Something went wrong while analyzing that document.",
          });
          return;
        }

        // We allow the backend to send ui + per_brain (BOS bundle) or legacy markdown
        setResult({
          status: parsed?.status || "ok",
          title: parsed?.title || "Analysis Result",
          summary: parsed?.summary,
          combined: parsed?.combined,
          ...parsed,
        });
        return;
      }

      // BRANCH 2: text-only → use BOS Validator /run-ea (credits + CXO brains)
      const brief = text.trim();
      if (!brief) {
        throw new Error("Enter a brief to analyze.");
      }
      if (!me?.id) {
        throw new Error(
          "User profile not loaded yet. Please refresh and log in again.",
        );
      }

      const planTier = mapTierToPlanTier(tier, me.is_admin);

      const packet = {
        mode: "dashboard_quick_analyze",
        brief,
        file_name: null as string | null,
        context: {
          source: "dashboard_quick_analyze",
          brains: ["cfo", "chro", "coo", "cmo", "cpo"],
        },
      };

      const bosRes = await withTimeout(
        runEAValidator(packet, {
          userId: me.id,
          planTier,
          timeoutSec: 300,
          numPredict: 512,
        }),
        120000,
      );

      setResult({
        status: "ok",
        title:
          bosRes.ui?.executive_summary?.trim() ||
          bosRes.ui?.summary?.trim() ||
          "Analysis Result",
        summary: bosRes.ui?.summary || "",
        combined: undefined,
        ...bosRes,
      });

      // refresh wallet after successful run
      try {
        const bal = await fetchWalletBalance(me.id);
        onWalletUpdate?.(bal.balance_credits);
      } catch (e) {
        console.warn("Failed to refresh wallet balance after run:", e);
      }
    } catch (e: any) {
      const raw = String(e?.message || e || "").toLowerCase();
      if (
        raw.includes("insufficient") ||
        raw.includes("no credit") ||
        raw.includes("payment required") ||
        raw.includes("402")
      ) {
        setFriendlyErr("nocredits");
      } else if (raw.includes("timeout")) {
        setFriendlyErr("timeout");
      } else if (
        raw.includes("expired") ||
        raw.includes("unauthorized") ||
        raw.includes("invalid token")
      ) {
        setFriendlyErr("auth");
      } else {
        setFriendlyErr("network");
      }
    } finally {
      setBusy(false);
      setAnalyzing(false);
    }
  }

  // Drag & drop handlers (unchanged)
  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }
  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  }

  return (
    <>
      {/* cinematic overlay */}
      <AnalyzingOverlay active={analyzing} />

      <section className="mt-6 space-y-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 shadow-xl">
          <h2 className="text-lg font-semibold mb-1">
            Quick 5-CXO analysis (Demo &amp; Pro)
          </h2>
          <p className="text-xs text-zinc-400 mb-4">
            Paste a short brief or upload a key document. CAIO will read it like
            a CFO, CHRO, COO, CMO, and CPO together and highlight the top risks
            and opportunities.
          </p>

          {/* Input row */}
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-stretch">
            {/* Left: textarea */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-300">
                Business brief or question
              </label>
              <textarea
                className="min-h-[140px] rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/60 resize-vertical"
                placeholder="Example: We're seeing flat revenue but marketing spend is up 30%. Can you scan this and tell me what each CXO would worry about?"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <p className="text-[11px] text-zinc-500">
                Tip: For the BOS preview, focus on 3–8 lines of context instead
                of pasting an entire report.
              </p>
            </div>

            {/* Right: file dropzone */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-300">
                Optional document (legacy pipeline)
              </label>
              <div
                className={[
                  "flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center text-xs transition-all",
                  dragActive
                    ? "border-blue-400 bg-blue-500/10"
                    : "border-zinc-700 bg-black/30",
                ].join(" ")}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <div className="mb-2 text-zinc-200">
                  {file ? (
                    <>
                      <div className="font-mono text-[11px]">{file.name}</div>
                      <button
                        className="mt-2 rounded-md border border-zinc-600 px-2 py-1 text-[11px] hover:bg-zinc-800"
                        onClick={() => setFile(null)}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-[12px] font-medium text-zinc-200">
                        Drop a file here
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-400">
                        PDF, Word, Excel, PowerPoint, or text.{" "}
                        <button
                          type="button"
                          onClick={onBrowseClick}
                          className="underline underline-offset-2 text-blue-300 hover:text-blue-200"
                        >
                          Browse
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => onFileChosen(e.target.files?.[0])}
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                For now, uploads go through CAIO&apos;s original analyzer. The
                BOS validator preview uses the text brief.
              </p>
            </div>
          </div>

          {/* Run button */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={run}
              disabled={busy}
              className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Analyzing…" : "Analyze"}
            </button>
            <div className="text-[11px] text-zinc-500">
              Tier:{" "}
              <span className="uppercase tracking-wide text-zinc-300">
                {tier}
              </span>
            </div>
          </div>

          {/* Friendly issue / timeout / network / auth / no-credits */}
          {friendlyErr && (
            <div className="mt-3">
              {friendlyErr === "nocredits" ? (
                <NoticeBanner
                  tone="limit"
                  title="You’re out of credits"
                  body="Your CAIO credits have been used up. Purchase a credit pack to keep running analyses."
                >
                  <Link
                    href="/payments"
                    className="rounded-md bg-fuchsia-600 px-3 py-1 text-white text-[13px] hover:bg-fuchsia-500"
                  >
                    Buy Credits
                  </Link>
                </NoticeBanner>
              ) : friendlyErr === "auth" ? (
                <NoticeBanner
                  tone="neutral"
                  title="Let’s sign back in"
                  body="Your session expired. Log in again to continue where you left off."
                />
              ) : friendlyErr === "timeout" ? (
                <NoticeBanner
                  tone="warn"
                  title="CAIO is waking up"
                  body="It took too long to finish that run. This can happen while the analysis service is spinning up. Nothing’s lost — you can hit Analyze again."
                />
              ) : (
                <NoticeBanner
                  tone="warn"
                  title="We couldn’t finish that run"
                  body="Network was flaky or the service didn’t respond in time. Nothing was lost — you can hit Analyze again."
                />
              )}
            </div>
          )}

          {/* Limit messages (rate limit etc. — still used for legacy /api/analyze) */}
          {limit && (
            <div className="mt-3">
              <NoticeBanner
                tone="limit"
                title="You’ve reached today’s trial limit"
                body={
                  <>
                    You’re at the cap for this plan
                    {typeof limit.used === "number" &&
                    typeof limit.limit === "number"
                      ? ` (${limit.used}/${limit.limit} runs used)`
                      : ""}
                    .{" "}
                    {limit.reset_at
                      ? `Your remaining usage refills at ${formatUtcShort(
                          limit.reset_at,
                        )}.`
                      : ""}{" "}
                    Upgrade to keep going without waiting.
                  </>
                }
              >
                <a
                  href="/payments"
                  className="rounded-md bg-fuchsia-600 px-3 py-1 text-white text-[13px] hover:bg-fuchsia-500"
                >
                  Upgrade
                </a>
                <a
                  href="/trial/chat"
                  className="rounded-md border border-zinc-600 px-3 py-1 text-[13px] hover:bg-zinc-800 text-zinc-100"
                >
                  Try Chat
                </a>
              </NoticeBanner>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="mt-3">
              {result.status === "error" ? (
                <div className="p-4 rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-100">
                  <h3 className="font-semibold">
                    {result.title || "We couldn’t finish that run"}
                  </h3>
                  <p className="text-sm mt-1">{result.message}</p>
                </div>
              ) : (result as any).ui && (result as any).per_brain ? (
                // BOS dashboard view when backend provides ui + per_brain bundle
                <BosDashboard bos={result as any} />
              ) : (
                // Fallback: legacy grouped report based on markdown + combined JSON
                <GroupedReport
                  title={result.title || "Analysis Result"}
                  md={result.summary || ""}
                  combined={result.combined}
                  tier={tier}
                />
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/* ---------------- BOS visual dashboard (NEW) ---------------- */

function BosDashboard({ bos }: { bos: any }) {
  const [active, setActive] = useState<BrainId>("ea");

  const ui = bos.ui;
  const perBrain = bos.per_brain || {};

  const brains: BrainId[] = ["ea", "cfo", "coo", "cmo", "chro", "cpo"];

  return (
    <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-900/70 text-zinc-100 space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-2">
        {brains.map((b) => (
          <button
            key={b}
            onClick={() => setActive(b)}
            className={tabClass(active === b)}
          >
            {b.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Active panel */}
      {active === "ea" ? (
        <EAOverview ui={ui} />
      ) : (
        <BrainPanel
          id={active as Exclude<BrainId, "ea">}
          data={perBrain[active]}
        />
      )}
    </div>
  );
}

function tabClass(active: boolean) {
  return [
    "px-3 py-1 rounded-full text-xs md:text-sm",
    active
      ? "bg-zinc-100 text-zinc-900"
      : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700",
  ].join(" ");
}

/* ---------------- Grouped report (legacy fallback) ---------------- */

function GroupedReport({
  title,
  md,
  combined,
  tier,
}: {
  title: string;
  md: string;
  combined?: CombinedJSON;
  tier: Tier;
}) {
  const desiredOrder = ["CFO", "CHRO", "COO", "CMO", "CPO"] as const;

  const jsonCollective = useMemo(() => {
    const list =
      combined?.aggregate?.collective ??
      combined?.aggregate?.collective_insights ??
      [];
    return list.slice(0, Math.max(2, Math.min(3, list.length)));
  }, [combined]);

  const jsonRoleTop1 = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    const byRole = combined?.details_by_role || {};
    const agg = combined?.aggregate || {};
    const aggMapA = agg.cxo_recommendations || {};
    const aggMapB = agg.recommendations_by_role || {};
    (["CFO", "CHRO", "COO", "CMO", "CPO"] as const).forEach((role) => {
      let first =
        byRole?.[role]?.recommendations?.[0] ??
        aggMapA?.[role]?.[0] ??
        aggMapB?.[role]?.[0];
      map[role] = first;
    });
    return map;
  }, [combined]);

  const fallbackBrains = useMemo(() => {
    if (combined) return [];
    const normalized = normalizeAnalysis(md);
    const brains = parseBrains(normalized);
    return brains;
  }, [combined, md]);

  const fallbackCollective = useMemo(() => {
    if (combined) return [];
    const blocks = fallbackBrains.map((b) => b.insights || "");
    const all: string[] = [];
    blocks.forEach((b) =>
      extractListItems(b ? b : "").forEach((x) => all.push(x)),
    );
    return all.slice(0, Math.max(2, Math.min(3, all.length)));
  }, [combined, fallbackBrains]);

  function RoleCard({
    label,
    rec,
    showUpsell = true,
  }: {
    label: string;
    rec?: string;
    showUpsell?: boolean;
  }) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <header className="flex items-center justify-between">
          <h4 className="text-lg font-medium">{label}</h4>
        </header>

        {rec ? (
          <div className="mt-2 text-sm text-zinc-100">
            <InlineMD text={rec} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            No specific recommendation yet for this role in this quick view.
          </p>
        )}

        {showUpsell && (tier === "demo" || tier === "pro") && (
          <div className="mt-3 text-[11px] text-zinc-500">
            Want a deeper breakdown for {label}? Upload the full pack or use
            Premium Chat for multi-run comparisons.
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="text-xs text-zinc-400">
              Snapshot of the most important cross-functional insights we could
              extract from this run.
            </p>
          </div>
        </header>

        {/* Collective insights */}
        <div className="mt-3 space-y-2">
          <h4 className="text-sm font-medium text-zinc-200">
            Cross-functional highlights
          </h4>
          <ul className="ml-4 list-disc space-y-1 text-sm text-zinc-200">
            {(jsonCollective.length ? jsonCollective : fallbackCollective).map(
              (item, idx) => (
                <li key={idx}>
                  <InlineMD text={item} />
                </li>
              ),
            )}
          </ul>
        </div>
      </section>

      {/* Role cards */}
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {desiredOrder.map((role) => {
          const label = role;
          const rec =
            jsonRoleTop1[role] ||
            fallbackBrains.find((b) => b.role === role)?.insights;
          return <RoleCard key={role} label={label} rec={rec} />;
        })}
      </section>
    </div>
  );
}
