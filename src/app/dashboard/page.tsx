"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import LogoutButton from "../../components/LogoutButton";

/* ---------------- Config ---------------- */
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

/* ---------- Types ---------- */
type Tier = "admin" | "premium" | "pro_plus" | "pro" | "demo";
type Me = { email: string; is_admin: boolean; is_paid: boolean; created_at?: string; tier?: Tier };
type Result =
  | { status: "demo"; title: string; summary: string; tip?: string }
  | { status: "error"; title: string; message: string; action?: string }
  | { status: "ok"; title?: string; summary?: string; [k: string]: any };

/* ---------------- Utils ---------------- */
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

/* ---------- Markdown helpers ---------- */
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
function extractListItems(text: string): string[] {
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

  // Redirect premium experiences to chat
  useEffect(() => {
    if (!busy && token && (me?.tier === "admin" || me?.tier === "premium" || me?.tier === "pro_plus")) {
      router.replace("/premium/chat");
    }
  }, [busy, token, me?.tier, router]);

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
        {/* header */}
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
                  {me?.tier === "admin" && (
                    <Link href="/admin" className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm shadow">
                      Admin Mode
                    </Link>
                  )}
                  <LogoutButton />
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
                href="/trial/chat"
                className="inline-flex items-center rounded-md bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-sm"
                title="Preview the premium chat experience"
              >
                Try Chat
              </Link>
            </div>
          )}

          {/* tiny hint while redirecting */}
          {token && (me?.tier === "admin" || me?.tier === "premium" || me?.tier === "pro_plus") && (
            <div className="mt-2 text-xs opacity-70">Redirecting to Premium Chat…</div>
          )}
        </header>

        {/* Demo/Pro dashboard */}
        {!busy && !err && !(me?.tier === "admin" || me?.tier === "premium" || me?.tier === "pro_plus") && (
          <AnalyzeCard token={token} isPaid={!!me?.is_paid} tier={(me?.tier || "demo") as Tier} />
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

/* ---------------- Analyze card ---------------- */

function AnalyzeCard({ token, isPaid, tier }: { token: string; isPaid: boolean; tier: Tier }) {
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
  function onFileChosen(f: File | undefined | null) { if (f) setFile(f); }
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

      // ✅ Always ask backend for all 5 CXO brains
      fd.append("brains", "CFO,CHRO,COO,CMO,CPO");

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
        setResult({
          status: "demo",
          title: parsed.title || "Demo Mode Result",
          summary: parsed.summary || "",
          tip: parsed.tip,
        });
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
      <h2 className="text-xl font-semibold">Quick analyze</h2>

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
            <button onClick={() => setLimit(null)} className="text-xs underline hover:no-underline">
              Dismiss
            </button>
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
          <svg width="28" height="28" viewBox="0 0 24 24" className="opacity-80">
            <path fill="currentColor" d="M19 12v7H5v-7H3v9h18v-9zM11 2h2v10h3l-4 4l-4-4h3z" />
          </svg>
          <p className="opacity-85">Drag & drop a document here</p>
          <p className="text-xs opacity-60">PDF, DOCX, TXT…</p>
          <button type="button" onClick={onBrowseClick} className="mt-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm">
            or browse files
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      {/* selected file */}
      {file && (
        <div className="flex items-center justify-between rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2 text-sm">
          <div className="truncate">
            <span className="opacity-90">{file.name}</span>
            <span className="opacity-60"> • {(file.size / 1024).toFixed(1)} KB</span>
          </div>
        </div>
      )}

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
          {isPaid ? "Manage plan" : "Need full features? Upgrade"}
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
      {result && (
        <div className="mt-3">
          {result.status === "error" ? (
            <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200">
              <h3 className="font-semibold">{result.title || "Analysis Unavailable"}</h3>
              <p className="text-sm mt-1">{result.message}</p>
            </div>
          ) : (
            <GroupedReport
              title={result.title || (result.status === "demo" ? "Demo Mode" : "Analysis Result")}
              md={result.summary || ""}
              demo={result.status === "demo"}
              tier={tier}
            />
          )}
        </div>
      )}
    </section>
  );
}

/* ---------------- Grouped report ---------------- */

function GroupedReport({
  title,
  md,
  demo = false,
  tier,
}: {
  title: string;
  md: string;
  demo?: boolean;
  tier: "admin" | "premium" | "pro_plus" | "pro" | "demo";
}) {
  const normalized = normalizeAnalysis(md);

  /* ---- Demo preview block ---- */
  if (demo) {
    return (
      <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-900/70 text-zinc-100 space-y-4">
        <h3 className="font-semibold">{title || "Demo Mode"}</h3>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm opacity-85">
          This is a preview. Run a full analysis with a document for richer CFO/CHRO insights.
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-lg font-medium">COO / CMO / CPO</div>
          <p className="mt-2 text-sm opacity-80">
            For more insights from COO, CMO, and CPO, please upgrade to <b>Pro</b>; to chat with CAIO, upgrade to <b>Pro+</b> or <b>Premium</b>.
          </p>
          <div className="mt-2 flex gap-2">
            <a href="/payments" className="rounded-md bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-500">Upgrade</a>
            <a href="/trial/chat" className="rounded-md border border-zinc-600 px-3 py-1 hover:bg-zinc-800">Try Chat</a>
          </div>
        </div>
      </div>
    );
  }

  /* ---- Full (non-demo): Pro = 5 brains, show Recommendations only ---- */
  const brains = parseBrains(normalized);
  const desiredOrder = ["CFO","CHRO","COO","CMO","CPO"] as const;

  const byName = (name: string) =>
    brains.find(b => (b.name || "").trim().toUpperCase().startsWith(name)) || null;

  const proOrAbove = tier === "pro" || tier === "pro_plus" || tier === "premium" || tier === "admin";

  // Pro or above: ALWAYS render all 5 cards (placeholders if missing)
  // Demo: render only sections that exist (handled elsewhere)
  const brainCards = (proOrAbove
    ? desiredOrder.map(label => ({ label, data: byName(label) }))
    : desiredOrder.map(label => ({ label, data: byName(label) })).filter(x => !!x.data)
  );

  function RoleCard({
    label,
    recommendations,
    tier,
  }: {
    label: string;
    recommendations?: string;
    tier: Tier;
  }) {
    // Recommendations ONLY (no Insights in individual CXO sections)
    const recItems = extractListItems(recommendations || "");

    // Demo: 1 rec; Pro and above: 3 recs (typical model output)
    const maxForTier = (t: Tier) => (t === "demo" ? 1 : 3);
    const showRecs = recItems.slice(0, maxForTier(tier));

    const showUpgradePlacard = tier === "demo";
    const showChatUpsell = tier === "pro";

    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <header className="flex items-center justify-between">
          <h4 className="text-lg font-medium">{label}</h4>
        </header>

        {/* Recommendations only */}
        {showRecs.length > 0 ? (
          <>
            <div className="mt-1 text-sm font-semibold opacity-90">Recommendations</div>
            <ol className="mt-2 list-decimal pl-6 space-y-1">
              {showRecs.map((it, i) => (
                <li key={i} className="leading-7">
                  <InlineMD text={it} />
                </li>
              ))}
            </ol>
          </>
        ) : (
          <div className="mt-2 text-sm opacity-70">No recommendations generated for this section.</div>
        )}

        {showUpgradePlacard && (
          <div className="mt-3 rounded-md border border-indigo-500/40 bg-indigo-500/10 p-3 text-[13px]">
            <div className="mb-1 font-semibold">Unlock more for {label}</div>
            <div className="opacity-90">
              For more insights, upgrade to <b>Pro</b> — or if you want to chat, go for <b>Pro+</b> or <b>Premium</b>.
            </div>
            <div className="mt-2 flex gap-2">
              <a href="/payments" className="rounded-md bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-500">Upgrade</a>
              <a href="/trial/chat" className="rounded-md border border-zinc-600 px-3 py-1 hover:bg-zinc-800">Try Chat</a>
            </div>
          </div>
        )}

        {showChatUpsell && (
          <div className="mt-3 rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-[13px]">
            <div className="mb-1 font-semibold">Chat unlock</div>
            <div className="opacity-90">
              Please try the Chat feature or upgrade to <b>Pro+</b> or <b>Premium</b> for full chat access.
            </div>
            <div className="mt-2 flex gap-2">
              <a href="/trial/chat" className="rounded-md border border-zinc-600 px-3 py-1 hover:bg-zinc-800">Try Chat</a>
              <a href="/payments" className="rounded-md bg-sky-600 px-3 py-1 text-white hover:bg-sky-500">Upgrade</a>
            </div>
          </div>
        )}
      </section>
    );
  }

  // Collective section (unchanged)
  const collective = (() => {
    const blocks = brains.map((b) => b.insights || "");
    const all: string[] = [];
    blocks.forEach((b) => extractListItems(b).forEach((x) => all.push(x)));
    const counts = new Map<string, { c: number; text: string }>();
    for (const it of all) {
      const key = it.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      counts.set(key, { c: (counts.get(key)?.c ?? 0) + 1, text: it });
    }
    const ranked = [...counts.values()]
      .sort((a, b) => b.c - a.c || b.text.length - a.text.length)
      .map((x) => x.text);
    return ranked.slice(0, 5);
  })();

  return (
    <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-900/70 text-zinc-100 space-y-4">
      <h3 className="font-semibold">{title || "Analysis Result"}</h3>

      {collective.length > 0 && (
        <details open className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <summary className="cursor-pointer text-lg font-medium select-none">Collective Insights (Top 5)</summary>
          <ol className="mt-3 list-decimal pl-6 space-y-1">
            {collective.map((it, i) => (
              <li key={i} className="leading-7"><InlineMD text={it} /></li>
            ))}
          </ol>
        </details>
      )}

      <div className="space-y-3">
        {brainCards.map(({ label, data }) => (
          <RoleCard
            key={label}
            label={label}
            recommendations={data?.recommendations}
            tier={tier}
          />
        ))}
      </div>
    </div>
  );
}
