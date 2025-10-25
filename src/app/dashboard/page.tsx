"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import LogoutButton from "@/components/LogoutButton";

// NEW: overlay
import AnalyzingOverlay from "@/components/AnalyzingOverlay";

/* ---------------- Config ---------------- */
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-orchestrator.onrender.com";

// bump when you redeploy to be sure caches are busted
const BUILD_ID = "dash-v1.8-ui-overlays";

/* ---------------- Types ---------------- */
type Tier = "admin" | "premium" | "pro_plus" | "pro" | "demo";
type Me = {
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
    { summary?: string | null; recommendations?: string[]; raw?: string | null }
  >;
  overall_summary?: string;
  document_filename?: string | null;
  insights?: any[];
};

type Result =
  | { status: "demo"; title?: string; summary?: string; combined?: CombinedJSON; tip?: string }
  | { status: "error"; title?: string; message: string; action?: string }
  | { status: "ok"; title?: string; summary?: string; combined?: CombinedJSON; [k: string]: any };

type LimitInfo = {
  plan?: string;
  used?: number;
  limit?: number;
  remaining?: number;
  reset_at?: string;
  title?: string;
  message?: string;
} | null;

/* ---------------- Small utils ---------------- */
function readTokenSafe(): string {
  try {
    const ls = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
    if (ls) return ls;
    const m = document.cookie.match(/(?:^|;)\s*token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

function withTimeout<T>(p: Promise<T>, ms = 120000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function ensureBackendReady(): Promise<void> {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE is not set.");
  const url = `${API_BASE}/api/ready`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(to);
    if (!r.ok) throw new Error(`ready ${r.status}`);
  } catch {
    clearTimeout(to);
    // retry a couple of times in case Render spun down
    for (let i = 0; i < 2; i++) {
      await new Promise((res) => setTimeout(res, 1000 + 600 * i));
      try {
        const r2 = await fetch(url, { cache: "no-store" });
        if (r2.ok) return;
      } catch {}
    }
  }
}

/* ---------------- Markdown helpers (fallback only) ---------------- */
function normalizeAnalysis(md: string) {
  let s = (md ?? "").trim();
  s = s.replace(/\n(?=#{2,3}\s+)/g, "\n\n");
  s = s.replace(/(#{2,3}\s+(Insights|Recommendations|Risks|Actions|Summary))/gi, "\n\n$1");
  s = s.replace(/(#{2,3}\s+[A-Z]{2,}.*?)(\s+#{2,3}\s+)/g, "$1\n\n$2");
  s = s.replace(/(\d\.\s[^\n])(?=\s*\d\.\s)/g, "$1\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s;
}

type BrainParse = { name: string; insights?: string; recommendations?: string };
function parseBrains(md: string): BrainParse[] {
  const sections = md
    .split(/\n(?=#{2,3}\s+[A-Z]{2,}.*$)/gm)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sections.length === 0) return [];

  return sections.map((sec, i) => {
    const headerMatch = sec.match(/^#{2,3}\s+(.+)$/m);
    const name = (headerMatch ? headerMatch[1] : `Section ${i + 1}`).trim();
    const body = sec.replace(/^#{2,3}\s+.+?\n/, "").trim();
    const getBlock = (label: string) => {
      const m = body.match(new RegExp(`#{2,3}\\s*${label}\\s*([\\s\\S]*?)(?=#{2,3}\\s*\\w+|$)`, "i"));
      return m ? m[1].trim() : undefined;
    };
    return { name, insights: getBlock("Insights"), recommendations: getBlock("Recommendations") };
  });
}

function extractListItems(text?: string): string[] {
  if (!text) return [];
  const cleaned = text.replace(/^[\s\S]*?(?=^\s*(?:\d+[.)]|[-*•])\s)/m, "");
  const parts = cleaned.split(/\n(?=\s*(?:\d+[.)]|[-*•])\s)/g);
  return parts.map((p) => p.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim()).filter(Boolean);
}

function InlineMD({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: (props) => <span {...props} /> }}>
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
          fetch(`${API_BASE}/api/profile`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" }),
          20000
        );
        if (res.status === 401) {
          setErr("Invalid token");
          return;
        }
        if (!res.ok) throw new Error(await res.text());
        const j = await res.json();
        setMe({
          email: j.email,
          is_admin: !!j.is_admin,
          is_paid: !!j.is_paid,
          created_at: j.created_at,
          tier: (j.tier as Tier) || "demo",
        });
      } catch (e: any) {
        setErr(e?.message || "Couldn’t load your profile. Please log in again.");
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
      } catch {}
      if (!redirectingRef.current) {
        redirectingRef.current = true;
        router.replace("/login");
      }
    }
  }, [err, router]);

  // Admins act like Premium
  const effectiveTier: Tier | undefined = me?.is_admin ? "premium" : me?.tier;

  // Redirect Pro+ / Premium / Admin straight to premium chat
  useEffect(() => {
    if (redirectingRef.current) return;
    if (busy) return;
    if (!token || !me) return;

    const highTier = me.is_admin || effectiveTier === "premium" || effectiveTier === "pro_plus";
    if (highTier) {
      redirectingRef.current = true;
      router.replace("/premium/chat");
    }
  }, [busy, token, me, effectiveTier, router]);

  const plan = useMemo(() => {
    if (me?.is_admin) return "Premium";
    if (effectiveTier === "premium") return "Premium";
    if (effectiveTier === "pro_plus") return "Pro+";
    if (effectiveTier === "pro") return "Pro";
    return "Demo";
  }, [effectiveTier, me?.is_admin]);

  const planClass =
    plan === "Premium"
      ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
      : plan === "Pro+"
      ? "bg-fuchsia-500/15 border-fuchsia-400/40 text-fuchsia-200"
      : plan === "Pro"
      ? "bg-sky-500/15 border-sky-400/40 text-sky-200"
      : "bg-amber-500/15 border-amber-400/40 text-amber-200";

  if (redirectingRef.current) {
    return (
      <main className="min-h-screen p-6 bg-zinc-950 text-zinc-100">
        <div className="max-w-4xl mx-auto">
          <div className="mt-8 bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800">
            Redirecting to Premium Chat…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Dashboard</h1>
              <p className="opacity-85 mt-1">
                {token ? (
                  <>
                    Logged in as <b>{me?.email ?? "…"}</b> • {me?.is_admin ? "Admin" : "User"}
                  </>
                ) : (
                  <>You’re not logged in.</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {token ? (
                <>
                  <span className={`px-2.5 py-1 rounded-full text-xs tracking-wide border ${planClass}`}>{plan}</span>
                  {me?.is_admin && (
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
          </div>

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
          {token && (me?.is_admin || effectiveTier === "premium" || effectiveTier === "pro_plus") && (
            <div className="mt-2 text-xs opacity-70">Redirecting to Premium Chat…</div>
          )}
        </header>

        {/* Demo/Pro dashboard only; higher tiers are redirected */}
        {!busy && !err && !(me?.is_admin || effectiveTier === "premium" || effectiveTier === "pro_plus") && (
          <AnalyzeCard token={token} tier={(effectiveTier || "demo") as Tier} />
        )}

        {busy && token && (
          <div className="bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800">
            <div className="animate-pulse opacity-80">Loading…</div>
          </div>
        )}
        {err && (
          <div className="bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800">
            <p className="text-red-300">{err}</p>
          </div>
        )}
      </div>
    </main>
  );
}

/* ---------------- Analyze card (Demo/Pro only) ---------------- */

function AnalyzeCard({ token, tier }: { token: string; tier: Tier }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // busy = backend in flight
  const [busy, setBusy] = useState(false);

  // NEW: analyzing = controls cinematic overlay
  const [analyzing, setAnalyzing] = useState(false);

  const [result, setResult] = useState<Result | null>(null);
  const [friendlyErr, setFriendlyErr] = useState<string | null>(null);
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
      if (!text.trim() && !file) throw new Error("Enter a brief or upload a file to analyze.");

      await ensureBackendReady();

      const fd = new FormData();
      if (text.trim()) fd.append("text", text.trim());
      if (file) fd.append("file", file);
      fd.append("brains", "CFO,CHRO,COO,CMO,CPO");

      const res = await withTimeout(
        fetch(`${API_BASE}/api/analyze`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: fd,
        }),
        120000
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
        setFriendlyErr("Your session expired. Please log in again.");
        return;
      }
      if (res.status === 413) {
        setFriendlyErr("That file is too large for your current plan.");
        return;
      }
      if (res.status === 415) {
        setFriendlyErr("That file type isn’t supported. Try PDF, DOCX, or TXT.");
        return;
      }
      if (!res.ok) {
        const message =
          parsed?.message || parsed?.detail || raw || "Something went wrong while analyzing your request.";
        setResult({
          status: "error",
          title: "Analysis Unavailable",
          message,
          action: "Please try again later.",
        });
        return;
      }

      // New backend returns { job_id, combined: {...} }
      const combined: CombinedJSON | undefined = parsed?.combined;

      setResult({
        status: "ok",
        title: parsed.title || "Analysis Result",
        summary: parsed.summary || "",
        combined,
        ...parsed,
      });
    } catch (e: any) {
      const msg = String(e?.message || e);
      setFriendlyErr(
        msg.includes("Failed to fetch")
          ? "Couldn’t reach the server. If this persists, check your API base URL or try again."
          : msg
      );
    } finally {
      setBusy(false);
      setAnalyzing(false); // hide overlay once we got a final state
    }
  }

  return (
    <>
      {/* overlay at root of AnalyzeCard so it can go fullscreen */}
      <AnalyzingOverlay active={analyzing} />

      <section className="bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800 space-y-5">
        <h2 className="text-xl font-semibold">Quick analyze</h2>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
          className={`rounded-xl border-2 border-dashed p-6 text-sm transition ${
            dragActive
              ? "border-blue-400 bg-blue-400/10"
              : "border-zinc-700 hover:border-zinc-500 bg-zinc-950/40"
          }`}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" className="opacity-80">
              <path
                fill="currentColor"
                d="M19 12v7H5v-7H3v9h18v-9zM11 2h2v10h3l-4 4l-4-4h3z"
              />
            </svg>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="opacity-85">Drag & drop a document here</p>
            <p className="text-xs opacity-60">PDF, DOCX, TXT…</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
            >
              or browse files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {/* Selected file */}
        {file && (
          <div className="flex items-center justify-between rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2 text-sm">
            <div className="truncate">
              <span className="opacity-90">{file.name}</span>
              <span className="opacity-60"> • {(file.size / 1024).toFixed(1)} KB</span>
            </div>
            <button
              onClick={() => setFile(null)}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs"
            >
              Remove
            </button>
          </div>
        )}

        {/* Prompt */}
        <div className="space-y-2">
          <label className="text-sm opacity-85">Brief / instructions</label>
          <textarea
            className="w-full h-28 p-3 rounded-xl text-zinc-100 placeholder-zinc-400 bg-zinc-950/60 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            placeholder="Describe what you want CAIO to analyze…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={run}
            disabled={busy}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 shadow"
          >
            {busy ? "Analyzing…" : "Analyze"}
          </button>
          <Link
            href="/payments"
            className="text-sm underline text-blue-300 hover:text-blue-200"
          >
            Need full features? Upgrade
          </Link>
        </div>

        {/* Errors */}
        {friendlyErr && (
          <div className="mt-3 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200">
            <h3 className="font-semibold mb-1">We hit a snag</h3>
            <p className="text-sm">{friendlyErr}</p>
          </div>
        )}

        {/* Limit messages (rate limit etc.) */}
        {limit && (
          <div className="mt-3 p-4 rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-200 text-sm leading-relaxed">
            <div className="font-semibold mb-1">
              {limit.title || "Daily limit reached"}
            </div>
            <div className="opacity-90">{limit.message || "You’ve hit today’s usage limit."}</div>
            <div className="mt-2 text-[11px] opacity-70">
              Plan: {limit.plan ?? "—"} • Used: {limit.used ?? "—"} / {limit.limit ?? "—"} •
              Reset: {formatUtcShort(limit.reset_at)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
              <Link
                href="/payments"
                className="rounded-md bg-blue-600 px-3 py-1 text-white hover:bg-blue-500"
              >
                Upgrade
              </Link>
              <Link
                href="/trial/chat"
                className="rounded-md border border-zinc-600 px-3 py-1 hover:bg-zinc-800 text-zinc-100"
              >
                Try Chat
              </Link>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-3">
            {result.status === "error" ? (
              <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200">
                <h3 className="font-semibold">
                  {result.title || "Analysis Unavailable"}
                </h3>
                <p className="text-sm mt-1">{result.message}</p>
              </div>
            ) : (
              <GroupedReport
                title={result.title || "Analysis Result"}
                md={result.summary || ""}
                combined={result.combined}
                tier={tier}
              />
            )}
          </div>
        )}
      </section>
    </>
  );
}

/* ---------------- Grouped report ---------------- */

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

  // ---------- Prefer JSON from backend ----------
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

  // ---------- Fallback to markdown if JSON absent ----------
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
    blocks.forEach((b) => extractListItems(b).forEach((x) => all.push(x)));
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
          <>
            <div className="mt-1 text-sm font-semibold opacity-90">
              Recommendation
            </div>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li className="leading-7">
                <InlineMD text={rec} />
              </li>
            </ul>
          </>
        ) : (
          <div className="mt-2 text-sm opacity-70">
            No recommendations generated for this section.
          </div>
        )}

        {showUpsell && (
          <div className="mt-3 rounded-md border border-indigo-500/40 bg-indigo-500/10 p-3 text-[13px]">
            <div className="mb-1 font-semibold">Unlock more for {label}</div>
            <div className="opacity-90">
              For more insights, upgrade to <b>Pro</b> — or if you want to chat,
              go for <b>Pro+</b> or <b>Premium</b>.
            </div>
            <div className="mt-2 flex gap-2">
              <a
                href="/payments"
                className="rounded-md bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-500"
              >
                Upgrade
              </a>
              <a
                href="/trial/chat"
                className="rounded-md border border-zinc-600 px-3 py-1 hover:bg-zinc-800"
              >
                Try Chat
              </a>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-900/70 text-zinc-100 space-y-4">
      <h3 className="font-semibold">{title || "Analysis Result"}</h3>

      {/* Collective insights (2–3) */}
      {(jsonCollective.length > 0 || fallbackCollective.length > 0) && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-lg font-medium">Collective Insights</div>
          <ol className="mt-2 list-decimal pl-6 space-y-1">
            {(jsonCollective.length > 0 ? jsonCollective : fallbackCollective).map(
              (it, i) => (
                <li key={i} className="leading-7">
                  <InlineMD text={it} />
                </li>
              )
            )}
          </ol>

          {/* Upsell under collective */}
          <div className="mt-3 rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-[13px]">
            <div className="mb-1 font-semibold">Want deeper analysis?</div>
            <div className="opacity-90">
              Upgrade for full CXO breakdowns and more recommendations across
              roles.
            </div>
            <div className="mt-2 flex gap-2">
              <a
                href="/payments"
                className="rounded-md bg-sky-600 px-3 py-1 text-white hover:bg-sky-500"
              >
                Upgrade
              </a>
              <a
                href="/trial/chat"
                className="rounded-md border border-zinc-600 px-3 py-1 hover:bg-zinc-800"
              >
                Try Chat
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Per-role 1 recommendation with upsell */}
      <div className="space-y-3">
        {(["CFO", "CHRO", "COO", "CMO", "CPO"] as const).map((label) => {
          let rec: string | undefined = jsonRoleTop1[label];

          if (!combined) {
            // fallback to markdown parse, show first bullet from that role's recommendations
            const normalized = normalizeAnalysis(md);
            const brains = parseBrains(normalized);
            const b = brains.find((x) => (x.name || "").toUpperCase().startsWith(label));
            const items = extractListItems(b?.recommendations || "");
            rec = items[0];
          }

          return (
            <RoleCard
              key={label}
              label={label}
              rec={rec}
              showUpsell={true}
            />
          );
        })}
      </div>
    </div>
  );
}
