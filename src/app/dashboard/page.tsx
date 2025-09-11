"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/* ------------------------------ Config ------------------------------ */

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";
const NETLIFY_HOME = "https://caioai.netlify.app";

type Tier = "admin" | "premium" | "pro_plus" | "pro" | "demo";
type Me = { email: string; is_admin: boolean; is_paid: boolean; created_at?: string; tier?: Tier };
type Result =
  | { status: "demo"; title: string; summary: string; tip?: string }
  | { status: "error"; title: string; message: string; action?: string }
  | { status: "ok"; title?: string; summary?: string; [k: string]: any };

/* ------------------------------ Utils ------------------------------ */

function withTimeout<T>(p: Promise<T>, ms = 120000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}
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

/* ------------------------------ Markdown parsing ------------------------------ */

/** Strip stray code fences and normalise spacing/newlines */
function clean(md: string): string {
  return (md || "")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-zA-Z]*\s*/g, "").replace(/```/g, ""))
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split into per-CXO sections */
function splitByCXO(md: string): Record<"CFO"|"COO"|"CHRO"|"CMO"|"CPO", string> {
  const text = clean(md);
  const parts = text
    .split(/\n(?=#{2,3}\s+(CFO|COO|CHRO|CMO|CPO)\b)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const map = { CFO: "", COO: "", CHRO: "", CMO: "", CPO: "" } as Record<
    "CFO"|"COO"|"CHRO"|"CMO"|"CPO",
    string
  >;

  for (const sec of parts) {
    const m = /^#{2,3}\s+(CFO|COO|CHRO|CMO|CPO)\b/i.exec(sec);
    if (!m) continue;
    const role = m[1].toUpperCase() as keyof typeof map;
    map[role] = sec.replace(/^#{2,3}\s+\w+\b[^\n]*\n?/, "").trim();
  }
  return map;
}

/** Top-5 collective insights */
function extractCollectiveInsights(md: string): string[] {
  const text = clean(md);
  const m = /#{2,3}\s*Collective\s+Insights[^\n]*\n([\s\S]*?)(?=\n#{2,3}\s+\w+|$)/i.exec(text);
  const block = m ? m[1] : text;
  const items = block
    .split(/\n(?=\s*(?:\d+[.)]|[-*•])\s)/g)
    .map((p) => p.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim())
    .filter(Boolean);
  if (items.length >= 3) return items.slice(0, 5);

  // fallback: pull a couple from each CXO "Insights" sub-block
  const cxo = splitByCXO(text);
  const agg: string[] = [];
  (["CFO","COO","CHRO","CMO","CPO"] as const).forEach((role) => {
    const sec = cxo[role];
    if (!sec) return;
    const mm = /#{2,3}\s*Insights\s*([\s\S]*?)(?=\n#{2,3}\s*\w+|$)/i.exec(sec);
    const list = (mm ? mm[1] : sec)
      .split(/\n(?=\s*(?:\d+[.)]|[-*•])\s)/g)
      .map((p) => p.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim())
      .filter(Boolean);
    agg.push(...list.slice(0, 2));
  });
  return agg.slice(0, 5);
}

/** Up to 3 recos from a CXO section */
function extractRecommendations(cxoSection: string): string[] {
  if (!cxoSection) return [];
  const text = clean(cxoSection);
  const m = /#{2,3}\s*Recommendations\s*([\s\S]*?)(?=\n#{2,3}\s*\w+|$)/i.exec(text);
  const block = (m ? m[1] : text).trim();
  return block
    .split(/\n(?=\s*(?:\d+[.)]|[-*•])\s)/g)
    .map((p) => p.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

/* ------------------------------ Page ------------------------------ */

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string>("");
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = readTokenSafe();
    setToken(t);
    if (!t) { setBusy(false); return; }
    (async () => {
      try {
        const res = await withTimeout(
          fetch(`${API_BASE}/api/profile`, { headers: { Authorization: `Bearer ${t}` } }),
          20000
        );
        if (!res.ok) throw new Error(await res.text());
        const j = await res.json();
        setMe({
          email: j.email,
          is_admin: !!j.is_admin,
          is_paid: !!j.is_paid,
          created_at: j.created_at,
          tier: j.tier as Tier,
        });
      } catch (e: any) {
        setErr(e?.message || "Couldn’t load your profile. Please log in again.");
      } finally { setBusy(false); }
    })();
  }, []);

  // Users with chat tiers don’t use this page; redirect silently
  useEffect(() => {
    if (!busy && token && (me?.tier === "admin" || me?.tier === "premium" || me?.tier === "pro_plus")) {
      router.replace("/premium/chat");
    }
  }, [busy, token, me?.tier, router]);

  function logout() {
    try { localStorage.removeItem("access_token"); localStorage.removeItem("token"); } catch {}
    document.cookie = "token=; path=/; max-age=0; SameSite=Lax";
    window.location.assign(NETLIFY_HOME);
  }

  const planFromTier = (t?: string) =>
    t === "admin" || t === "premium" ? "Premium" : t === "pro_plus" ? "Pro+" : t === "pro" ? "Pro" : "Demo";

  const plan = planFromTier(me?.tier);
  const planClass =
    plan === "Premium"
      ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
      : plan === "Pro+"
      ? "bg-fuchsia-500/15 border-fuchsia-400/40 text-fuchsia-200"
      : plan === "Pro"
      ? "bg-sky-500/15 border-sky-400/40 text-sky-200"
      : "bg-amber-500/15 border-amber-400/40 text-amber-200";

  return (
    <main className="min-h-screen p-6 bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Dashboard</h1>
              <p className="opacity-85 mt-1">
                {token ? <>Logged in as <b>{me?.email ?? "…"}</b> • {me?.is_admin ? "Admin" : "User"}</> : <>You’re not logged in.</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {token ? (
                <>
                  <span className={`px-2.5 py-1 rounded-full text-xs tracking-wide border ${planClass}`}>{plan}</span>
                  <button onClick={logout} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm shadow">
                    Logout
                  </button>
                </>
              ) : (
                <Link href="/signup" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white">
                  Go to Login
                </Link>
              )}
            </div>
          </div>

          {/* CTA row for Demo & Pro */}
          {token && (me?.tier === "demo" || me?.tier === "pro") && (
            <div className="mt-3 flex items-center gap-3">
              {me?.tier === "demo" && !me?.is_paid && (
                <Link href="/payments" className="inline-block text-blue-300 underline hover:text-blue-200">
                  Upgrade to Pro
                </Link>
              )}
              <Link
                href="/premium/chat?trial=1"
                className="inline-flex items-center rounded-md bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-sm"
                title="Preview the premium chat experience"
              >
                Try Chat
              </Link>
            </div>
          )}

          {token && (me?.tier === "admin" || me?.tier === "premium" || me?.tier === "pro_plus") && (
            <div className="mt-2 text-xs opacity-70">Redirecting to Premium Chat…</div>
          )}
        </header>

        {/* Only Demo/Pro use this page */}
        {!busy && !err && !(me?.tier === "admin" || me?.tier === "premium" || me?.tier === "pro_plus") && (
          <AnalyzeCard token={token} tier={(me?.tier || "demo") as Tier} />
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

/* ---------------- Analyze card (with 429 banner) ---------------- */

function AnalyzeCard({ token, tier }: { token: string; tier: Tier }) {
  type LimitInfo = {
    plan?: string;
    used?: number;
    limit?: number;
    remaining?: number;
    reset_at?: string;
    title?: string;
    message?: string;
  };

  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [friendlyErr, setFriendlyErr] = useState<string | null>(null);
  const [limit, setLimit] = useState<LimitInfo | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  function onBrowseClick() { fileInputRef.current?.click(); }
  function onFileChosen(f?: File | null) { if (f) setFile(f); }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setDragActive(true); }
  function onDragLeave(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setDragActive(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const f = e.dataTransfer.files?.[0]; if (f) setFile(f);
  }

  function resetErrors() { setFriendlyErr(null); setLimit(null); setResult(null); }

  function formatUtcShort(iso?: string) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      return `${hh}:${mm} UTC`;
    } catch { return ""; }
  }

  async function run() {
    setBusy(true);
    resetErrors();
    try {
      const fd = new FormData();
      if (text.trim()) fd.append("text", text.trim());
      if (file) fd.append("file", file);
      if (!text.trim() && !file) throw new Error("Enter text or upload a file.");

      const res = await withTimeout(
        fetch(`${API_BASE}/api/analyze`, {
          method: "POST",
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: fd,
        }),
        120000
      );

      const raw = await res.text();
      let parsed: any = {};
      try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = {}; }

      if (res.status === 429) {
        setLimit({
          plan: parsed?.plan, used: parsed?.used, limit: parsed?.limit,
          remaining: parsed?.remaining, reset_at: parsed?.reset_at,
          title: parsed?.title || "Daily limit reached",
          message: parsed?.message || "You’ve hit today’s usage limit.",
        });
        return;
      }

      if (!res.ok) {
        const message = parsed?.message || parsed?.detail || raw || "Something went wrong while analyzing your request.";
        setResult({ status: "error", title: "Analysis Unavailable", message, action: "Please try again later." });
        return;
      }

      if (parsed?.status === "demo") {
        setResult({ status: "demo", title: parsed.title || "Demo Mode Result", summary: parsed.summary || "", tip: parsed.tip });
      } else {
        setResult({ status: "ok", title: parsed.title || "Analysis Result", summary: parsed.summary || "", ...parsed });
      }
    } catch (e: any) {
      setFriendlyErr(e?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800 space-y-5">
      <h2 className="text-xl font-semibold">Analyze</h2>

      {/* limit banner */}
      {limit && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{limit.title || "Daily limit reached"}</h3>
              <p className="text-sm mt-1">
                {limit.message}
                {typeof limit.used === "number" && typeof limit.limit === "number" && (
                  <> You’ve used <b>{limit.used}</b> of <b>{limit.limit}</b> today.</>
                )}
                {limit.reset_at && <> Resets at <b>{formatUtcShort(limit.reset_at)}</b>.</>}
              </p>
            </div>
            <button onClick={() => setLimit(null)} className="text-xs underline hover:no-underline">Dismiss</button>
          </div>
          {limit.plan === "demo" && (
            <div className="mt-2">
              <a href="/payments" className="inline-block text-xs px-2.5 py-1 rounded-md bg-amber-400/20 border border-amber-400/40 hover:bg-amber-400/30">
                Upgrade for higher daily limits
              </a>
            </div>
          )}
        </div>
      )}

      {/* dropzone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-6 text-sm transition ${
          dragActive ? "border-blue-400 bg-blue-400/10" : "border-zinc-700 hover:border-zinc-500 bg-zinc-950/40"
        }`}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <svg width="28" height="28" viewBox="0 0 24 24" className="opacity-80"><path fill="currentColor" d="M19 12v7H5v-7H3v9h18v-9zM11 2h2v10h3l-4 4l-4-4h3z" /></svg>
          <p className="opacity-85">Drag & drop a document here</p>
          <p className="text-xs opacity-60">PDF, DOCX, TXT…</p>
          <button type="button" onClick={onBrowseClick} className="mt-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm">
            or browse files
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      {/* prompt */}
      <div className="space-y-2">
        <label className="text-sm opacity-85">Brief / instructions</label>
        <textarea
          className="w-full h-28 p-3 rounded-xl text-zinc-100 placeholder-zinc-400 bg-zinc-950/60 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          placeholder="Describe what you want CAIO to analyze…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      {/* actions */}
      <div className="flex items-center gap-3">
        <button onClick={run} disabled={busy} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 shadow">
          {busy ? "Analyzing…" : "Analyze"}
        </button>
        <Link href="/payments" className="text-sm underline text-blue-300 hover:text-blue-200">
          Need full features? Upgrade
        </Link>
      </div>

      {/* errors */}
      {friendlyErr && (
        <div className="mt-3 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200">
          <h3 className="font-semibold mb-1">We hit a snag</h3>
          <p className="text-sm">{friendlyErr}</p>
        </div>
      )}

      {/* results */}
      {result && <AnalysisResult md={result.summary || ""} tier={tier} />}
    </section>
  );
}

/* ---------------- Analysis result renderer ---------------- */

function AnalysisResult({ md, tier }: { md: string; tier: Tier }) {
  const text = clean(md);

  // 1) Insights – top 5
  const insights = extractCollectiveInsights(text);

  // 2) All brains (always show the five roles)
  const roles = ["CFO", "COO", "CHRO", "CMO", "CPO"] as const;
  const byCXO = splitByCXO(text);
  const recos: Record<typeof roles[number], string[]> = {
    CFO: [], COO: [], CHRO: [], CMO: [], CPO: [],
  };
  roles.forEach((r) => (recos[r] = extractRecommendations(byCXO[r])));

  const isDemo = tier === "demo";
  const isPro = tier === "pro";
  const isChatTier = tier === "pro_plus" || tier === "premium" || tier === "admin";

  return (
    <div className="space-y-4">
      {/* Insights */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <details open>
          <summary className="cursor-pointer text-sm font-semibold opacity-90">Collective Insights (Top 5)</summary>
          <ol className="mt-3 list-decimal pl-6 space-y-1">
            {insights.map((it, i) => <li key={i} className="leading-7">{it}</li>)}
          </ol>
        </details>
      </div>

      {/* Recommendations per brain */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="text-sm font-semibold opacity-90 mb-2">Recommendations</div>
        <div className="space-y-3">
          {roles.map((role) => {
            const items = recos[role];
            return (
              <details key={role} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <summary className="cursor-pointer text-base font-medium select-none">{role} recommends</summary>

                {/* DEMO: fully locked (no preview) */}
                {isDemo && <LockedUpsell />}

                {/* PRO: show bullets + upsell */}
                {isPro && items.length > 0 && (
                  <>
                    <ol className="mt-2 list-decimal pl-6 space-y-1">
                      {items.map((t, i) => <li key={i} className="leading-7">{t}</li>)}
                    </ol>
                    <Upsell />
                  </>
                )}

                {/* PRO+ / PREMIUM / ADMIN: placeholder line only */}
                {isChatTier && (
                  <div className="mt-2 text-sm opacity-85">
                    If you need insights from the CMO, CHRO, and CPO, upgrade to <b>Pro</b>; if you want to chat with CAIO, upgrade to <b>Pro+</b> or <b>Premium</b>.
                  </div>
                )}
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Small UI blocks ---------------- */

function Upsell() {
  return (
    <div className="mt-3 rounded-md border border-indigo-500/40 bg-indigo-500/10 p-3 text-[13px]">
      <div className="opacity-90">
        For more insights, upgrade to <b>Pro</b> — or if you want to chat, go for <b>Pro+</b> or <b>Premium</b>.
      </div>
      <div className="mt-2 flex gap-2">
        <a href="/payments" className="rounded-md bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-500">Upgrade</a>
        <a href="/premium/chat?trial=1" className="rounded-md border border-zinc-600 px-3 py-1 hover:bg-zinc-800">Try Chat</a>
      </div>
    </div>
  );
}

function LockedUpsell() {
  return (
    <div className="mt-2 rounded-md border border-indigo-500/40 bg-indigo-500/10 p-3 text-[13px]">
      <div className="font-semibold mb-1">Locked in Demo</div>
      <div className="opacity-90">
        Upgrade to <b>Pro</b> for role-specific recommendations. If you want chat or file uploads, go for <b>Pro+</b> or <b>Premium</b>.
      </div>
      <div className="mt-2 flex gap-2">
        <a href="/payments" className="rounded-md bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-500">Upgrade</a>
        <a href="/premium/chat?trial=1" className="rounded-md border border-zinc-600 px-3 py-1 hover:bg-zinc-800">Try Chat</a>
      </div>
    </div>
  );
}
