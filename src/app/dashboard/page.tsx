"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";
const NETLIFY_HOME = "https://caioai.netlify.app";

type Me = { email: string; is_admin: boolean; is_paid: boolean; created_at?: string };
type Result =
  | { status: "demo"; title: string; summary: string; tip?: string }
  | { status: "error"; title: string; message: string; action?: string }
  | { status: "ok"; title?: string; summary?: string; [k: string]: any };

/* ---------------- Utils ---------------- */

function withTimeout<T>(p: Promise<T>, ms = 120000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

function readTokenSafe(): string {
  try {
    const ls = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
    if (ls) return ls;
    const m = document.cookie.match(/(?:^|;)\s*token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  } catch { return ""; }
}

/* ---------- Markdown helpers (spacing + parsing) ---------- */

function normalizeAnalysis(md: string) {
  let s = (md ?? "").trim();
  s = s.replace(/\n(?=###\s+)/g, "\n\n");
  s = s.replace(/(###\s+(Insights|Recommendations|Risks|Actions|Summary))/gi, "\n\n$1");
  s = s.replace(/(###\s+[A-Z]{2,}.*?)(\s+###\s+)/g, "$1\n\n$2");
  s = s.replace(/(\d\.\s[^\n])(?=\s*\d\.\s)/g, "$1\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s;
}

type BrainParse = {
  name: string;
  insights?: string;
  recommendations?: string;
};

/** Full-mode parser: split on ### {UPPERCASE} headers like ### CFO */
function parseBrains(md: string): BrainParse[] {
  const sections = md
    .split(/\n(?=###\s+[A-Z]{2,}.*$)/gm)
    .map(s => s.trim())
    .filter(Boolean);

  if (sections.length === 0) return [];

  return sections.map((sec, i) => {
    const headerMatch = sec.match(/^###\s+(.+)$/m);
    const name = (headerMatch ? headerMatch[1] : `Section ${i + 1}`).trim();
    const body = sec.replace(/^###\s+.+?\n/, "").trim();
    const getBlock = (label: string) => {
      const m = body.match(new RegExp(`###\\s*${label}\\s*([\\s\\S]*?)(?=###\\s*\\w+|$)`, "i"));
      return m ? m[1].trim() : undefined;
    };
    return {
      name,
      insights: getBlock("Insights"),
      recommendations: getBlock("Recommendations"),
    };
  });
}

/** Extract list items from any numbered/ul-style block */
function extractListItems(text: string): string[] {
  if (!text) return [];
  const cleaned = text.replace(/^[\s\S]*?(?=^\s*(?:\d+[.)]|[-*•])\s)/m, "");
  const parts = cleaned.split(/\n(?=\s*(?:\d+[.)]|[-*•])\s)/g);
  return parts.map(p => p.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim()).filter(Boolean);
}

/** Split into sentences and keep meaningful ones */
function sentences(text: string): string[] {
  const clean = text
    .replace(/^#+\s.*$/gm, " ")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return clean.split(/(?<=[.!?])\s+(?=[A-Z(])/).filter(s => s.length > 40);
}

/** Grab block(s) following a specific heading anywhere, e.g. "Insights" or "Recommendations" */
function extractHeadingBlock(md: string, label: string): string {
  const re = new RegExp(`###\\s*${label}\\s*([\\s\\S]*?)(?=\\n###\\s*\\w+|$)`, "ig");
  let out = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) out += (out ? "\n\n" : "") + (m[1] || "");
  return out.trim();
}

/** Text before the first Recommendations heading (fallback material for insights) */
function textBeforeRecommendations(md: string): string {
  const idx = md.search(/###\s*Recommendations/i);
  return idx >= 0 ? md.slice(0, idx) : md;
}

/** Inline MD so **bold** etc. work inside list items */
function InlineMD({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: (props) => <span {...props} /> }}>
      {text}
    </ReactMarkdown>
  );
}

/** Trim second demo bullet nicely and append teaser */
function truncateForDemo(text: string, maxChars = 120, teaser = " _…Upgrade to see the full item._") {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean + teaser;
  const clipped = clean.slice(0, maxChars).replace(/[\s,.-]+[^,.\s-]*$/, "");
  return clipped + teaser;
}

/** Fallback single action from insights if model gave no recs */
function deriveOneActionFromInsights(insights?: string): string | null {
  const first = extractListItems(insights || "")[0] || sentences(insights || "")[0];
  if (!first) return null;
  if (/^\s*\*\*.+?\*\*\s*:/.test(first)) return first;
  return `**Priority Action**: ${first}`;
}

/** Detects obvious demo placeholder text coming from backend */
function looksLikeDemo(text: string) {
  return /demo preview|upgrade to pro|brains used/i.test(text || "");
}

/** Synthesizes one realistic insight & CFO/CHRO recommendations from the brief/file name */
function synthesizeFromContext(seedText: string, fileName?: string) {
  const src = `${seedText || ""} ${fileName || ""}`.toLowerCase();

  const hasRevenue = /(revenue|forecast|projection|budget|p&l|profit|invoice|cash\s?flow|collections|ds[o0])/i.test(src);
  const hasHiring  = /(hiring|recruit|offer|headcount|attrition|engagement|talent|people)/i.test(src);
  const hasOps     = /(ops|operations|sla|throughput|backlog|process|capacity)/i.test(src);

  const insight =
    hasRevenue
      ? "**Liquidity exposure from slow collections**: the document context suggests revenue planning and payment timing; extend your cash planning by monitoring DSO and top-account ageing to avoid month-end crunches."
      : hasHiring
      ? "**Talent stability risk**: the context points to headcount changes; track acceptance rates and exit drivers by function to prevent productivity loss."
      : hasOps
      ? "**Throughput constraint**: there are signals of process load; identify the longest queue (bottleneck) and rebalance work-in-progress limits."
      : "**Execution risk**: the document hints at important changes; align owners, timelines, and a single KPI per workstream to prevent slippage.";

  const cfo =
    hasRevenue
      ? "**Shorten DSO by 3–5 days**: add early-payment discounts (1/10 net 30) for top 20 AR accounts, automate reminders at +3/+7/+14, and reconcile unapplied cash weekly to lift cash conversion."
      : "**Tighten spend governance**: enforce PO-before-invoice for vendors, and roll a weekly cash bridge (opening → ops → financing) to forecast runway with ±5% error.";

  const chro =
    hasHiring
      ? "**Stabilize offers & ramp**: set a 48-hour SLA for feedback, publish compensation bands in JD, and run ‘why-we-win/lose’ on offers to lift acceptance by 10–15%."
      : "**Lower regrettable attrition**: run quarterly stay-interviews for top 10% performers, add manager 1:1 scorecards, and flag teams with >2 back-to-back low eNPS for intervention.";

  return { insight, cfo, chro };
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
        setMe({ email: j.email, is_admin: !!j.is_admin, is_paid: !!j.is_paid, created_at: j.created_at });
      } catch (e: any) {
        setErr(e?.message || "Couldn’t load your profile. Please log in again.");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  function logout() {
    try { localStorage.removeItem("access_token"); localStorage.removeItem("token"); } catch {}
    document.cookie = "token=; path=/; max-age=0; SameSite=Lax";
    window.location.assign(NETLIFY_HOME);
  }

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
                  <span className={`px-2.5 py-1 rounded-full text-xs tracking-wide border ${
                    me?.is_paid ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
                                  : "bg-amber-500/15 border-amber-400/40 text-amber-200"}`}>
                    {me?.is_paid ? "Pro" : "Demo"}
                  </span>
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

          {!me?.is_paid && token && (
            <div className="mt-3">
              <Link href="/payments" className="inline-block text-blue-300 underline hover:text-blue-200">
                Upgrade to Pro
              </Link>
            </div>
          )}
        </header>

        {/* states */}
        {busy && token && (
          <div className="bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800">
            <div className="animate-pulse opacity-80">Loading…</div>
          </div>
        )}

        {err && (
          <div className="bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800">
            <p className="text-red-300">{err}</p>
            <div className="mt-3 flex gap-2">
              <Link href="/signup" className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm">Re-login</Link>
              <button onClick={() => router.refresh()} className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm">Retry</button>
              {token && <button onClick={logout} className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-sm">Logout</button>}
            </div>
          </div>
        )}

        {/* analyze card */}
        {!busy && !err && <AnalyzeCard token={token} isPaid={!!me?.is_paid} />}
      </div>
    </main>
  );
}

/* ---------------- Analyze card ---------------- */

function AnalyzeCard({ token, isPaid }: { token: string; isPaid: boolean }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [friendlyErr, setFriendlyErr] = useState<string | null>(null);

  const [exportBusy, setExportBusy] = useState<"pdf" | "docx" | null>(null); // NEW

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  function onBrowseClick() { fileInputRef.current?.click(); }
  function onFileChosen(f: File | undefined | null) { if (f) setFile(f); }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setDragActive(true); }
  function onDragLeave(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setDragActive(false); }
  function onDrop(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }

  async function run() {
    setBusy(true); setFriendlyErr(null); setResult(null);
    try {
      const fd = new FormData();
      if (text.trim()) fd.append("text", text.trim());
      if (file) fd.append("file", file);
      if (!text.trim() && !file) throw new Error("Enter text or upload a file.");

      const res = await withTimeout(fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: fd,
      }), 120000);

      const raw = await res.text();
      let parsed: any = {};
      try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = {}; }

      if (!res.ok) {
        const message = parsed?.message || raw || "Something went wrong while analyzing your request.";
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

  // ---------- NEW: export helpers ----------
  function downloadBlob(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportBrief(fmt: "pdf" | "docx") {
    if (!result || result.status === "error") return;
    if (!isPaid) {
      window.location.assign("/payments");
      return;
    }
    const title = (result.title || "CAIO Brief").toString().replace(/[^\w\s-]+/g, "").slice(0, 60) || "CAIO Brief";
    const markdown = result.summary || "";
    setExportBusy(fmt);
    try {
      const res = await withTimeout(fetch(`${API_BASE}/api/export/${fmt}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ title, markdown }),
      }), 60000);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      downloadBlob(`${title}.${fmt === "pdf" ? "pdf" : "docx"}`, blob);
    } catch (e: any) {
      setFriendlyErr(e?.message || "Export failed. Please try again.");
    } finally {
      setExportBusy(null);
    }
  }
  // ----------------------------------------

  return (
    <section className="bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800 space-y-5">
      <h2 className="text-xl font-semibold">Quick analyze</h2>

      {/* dropzone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-6 text-sm transition
          ${dragActive ? "border-blue-400 bg-blue-400/10" : "border-zinc-700 hover:border-zinc-500 bg-zinc-950/40"}`}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <svg width="28" height="28" viewBox="0 0 24 24" className="opacity-80">
            <path fill="currentColor" d="M19 12v7H5v-7H3v9h18v-9zM11 2h2v10h3l-4 4l-4-4h3z"/>
          </svg>
          <p className="opacity-85">Drag & drop a document here</p>
          <p className="text-xs opacity-60">PDF, DOCX, TXT…</p>
          <button type="button" onClick={onBrowseClick} className="mt-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm">or browse files</button>
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
          <button onClick={() => setFile(null)} className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs">Remove</button>
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
          ) : result.status === "demo" ? (
            <>
              <GroupedReport title={result.title || "Demo Mode"} md={result.summary || ""} demo seedText={text} fileName={file?.name} />
              {/* ---- NEW: export toolbar (disabled on demo) ---- */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  disabled
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 cursor-not-allowed"
                  title="Upgrade to export"
                >
                  Export PDF
                </button>
                <button
                  disabled
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 cursor-not-allowed"
                  title="Upgrade to export"
                >
                  Export DOCX
                </button>
                <Link href="/payments" className="text-sm underline text-blue-300 hover:text-blue-200">
                  Upgrade to export
                </Link>
              </div>
            </>
          ) : (
            <>
              <GroupedReport title={result.title || "Analysis Result"} md={result.summary || ""} />
              {/* ---- NEW: export toolbar (enabled on Pro) ---- */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => exportBrief("pdf")}
                  disabled={!isPaid || exportBusy === "pdf"}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60"
                >
                  {exportBusy === "pdf" ? "Exporting…" : "Export PDF"}
                </button>
                <button
                  onClick={() => exportBrief("docx")}
                  disabled={!isPaid || exportBusy === "docx"}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60"
                >
                  {exportBusy === "docx" ? "Exporting…" : "Export DOCX"}
                </button>
              </div>
            </>
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
  seedText = "",
  fileName,
}: {
  title: string;
  md: string;
  demo?: boolean;
  seedText?: string;
  fileName?: string;
}) {
  const normalized = normalizeAnalysis(md);

  // ---------- DEMO MODE (CFO + CHRO; real content + teaser seconds) ----------
  if (demo) {
    // If the backend demo string is unhelpful, synthesize one meaningful item from context
    const ctx = synthesizeFromContext(seedText, fileName);

    // Try to extract real insights; if they look like demo placeholders, use synthesized
    const insightsBlock = extractHeadingBlock(normalized, "Insights");
    let insights = extractListItems(insightsBlock);
    if (insights.length === 0) {
      const preRec = textBeforeRecommendations(normalized);
      insights = extractListItems(preRec);
    }
    if (insights.length === 0) insights = sentences(textBeforeRecommendations(normalized));

    const i1 = (!looksLikeDemo(insights[0] || "") && insights[0]) || ctx.insight;
    const i2raw = (!looksLikeDemo(insights[1] || "") && (insights[1] || insights[0])) || ctx.insight;
    const i2 = truncateForDemo(i2raw);

    // Recommendations extraction
    const recBlock = extractHeadingBlock(normalized, "Recommendations");
    let recs = extractListItems(recBlock);

    const previewRoles = ["CFO", "CHRO"];
    const roleRecs: Record<string, { r1: string; r2: string }> = {};

    // CFO first bullet: prefer real, else synthesized CFO
    const cfo1 = (!looksLikeDemo(recs[0] || "") && recs[0]) || ctx.cfo || deriveOneActionFromInsights(i1) || "**Priority Action**: Address the most material item from insights.";
    const chro1 = (!looksLikeDemo(recs[1] || "") && recs[1]) || ctx.chro || "Implement targeted people actions derived from insights.";

    roleRecs["CFO"] = { r1: cfo1, r2: truncateForDemo(recs[2] || recs[0] || ctx.cfo) };
    roleRecs["CHRO"] = { r1: chro1, r2: truncateForDemo(recs[3] || recs[1] || ctx.chro) };

    const locked = ["COO", "CMO", "CPO"];

    return (
      <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-900/70 text-zinc-100 space-y-4">
        <h3 className="font-semibold">Demo Mode · CFO, CHRO</h3>

        <details open className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <summary className="cursor-pointer text-lg font-medium select-none">Collective Insights (preview)</summary>
          <ol className="mt-3 list-decimal pl-6 space-y-1">
            <li className="leading-7"><InlineMD text={i1} /></li>
            <li className="leading-7"><InlineMD text={i2} /></li>
          </ol>
        </details>

        <h4 className="text-base font-semibold opacity-90">Recommendations (preview)</h4>

        {previewRoles.map((role) => (
          <details key={role} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <summary className="cursor-pointer text-lg font-medium select-none">{role}</summary>
            <ol className="mt-3 list-decimal pl-6 space-y-1">
              <li className="leading-7"><InlineMD text={roleRecs[role].r1} /></li>
              <li className="leading-7"><InlineMD text={roleRecs[role].r2} /></li>
            </ol>
          </details>
        ))}

        <div className="grid gap-3 mt-2">
          {locked.map((name) => (
            <div key={name} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 opacity-75">
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium">{name}</span>
                <Link href="/payments" className="text-sm underline text-blue-300 hover:text-blue-200">
                  Upgrade to get full access
                </Link>
              </div>
              <p className="mt-2 text-sm opacity-80">
                Unlock full insights and all 3 recommendations for {name}.
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------- FULL (PRO) MODE ----------
  const brains = parseBrains(normalized);
  const collective = (() => {
    const blocks = brains.map(b => b.insights || "");
    const all: string[] = [];
    blocks.forEach(b => extractListItems(b).forEach(x => all.push(x)));
    const counts = new Map<string, { c: number; text: string }>();
    for (const it of all) {
      const key = it.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      counts.set(key, { c: (counts.get(key)?.c ?? 0) + 1, text: it });
    }
    const ranked = [...counts.values()]
      .sort((a, b) => (b.c - a.c) || (b.text.length - a.text.length))
      .map(x => x.text);

    if (ranked.length >= 5) return ranked.slice(0, 5);

    const unique: string[] = [];
    const seen = new Set(ranked.map(t => t.toLowerCase()));
    for (const b of blocks) {
      for (const it of extractListItems(b)) {
        const k = it.toLowerCase();
        if (!seen.has(k)) { unique.push(it); seen.add(k); }
        if (ranked.length + unique.length >= 5) break;
      }
      if (ranked.length + unique.length >= 5) break;
    }
    return ranked.concat(unique).slice(0, 5);
  })();

  return (
    <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-900/70 text-zinc-100 space-y-4">
      <h3 className="font-semibold">{title}</h3>

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
        <h4 className="text-base font-semibold opacity-90">Recommendations</h4>
        {brains.map((b, i) => {
          const top3 = extractListItems(b.recommendations || "").slice(0, 3);
          return (
            <details key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <summary className="cursor-pointer text-lg font-medium select-none">{b.name}</summary>
              <ol className="mt-3 list-decimal pl-6 space-y-1">
                {top3.map((it, j) => (
                  <li key={j} className="leading-7"><InlineMD text={it} /></li>
                ))}
              </ol>
            </details>
          );
        })}
      </div>
    </div>
  );
}
