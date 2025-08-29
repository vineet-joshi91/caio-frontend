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

function parseBrains(md: string): BrainParse[] {
  const sections = md
    .split(/\n(?=###\s+[A-Z]{2,}.*$)/gm)
    .map(s => s.trim())
    .filter(Boolean);

  if (sections.length === 0) return [{ name: "Analysis", insights: md }];

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

/** Extract multi-line list items and ignore any preamble before the first marker. */
function extractListItems(text: string): string[] {
  if (!text) return [];
  const cleaned = text.replace(/^[\s\S]*?(?=^\s*(?:\d+[.)]|[-*•])\s)/m, "");
  const parts = cleaned.split(/\n(?=\s*(?:\d+[.)]|[-*•])\s)/g);
  return parts
    .map(p => p.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim())
    .filter(Boolean);
}

/** Ensure exactly 3 recs; if fewer, pad with non-duplicated content from insights/text. */
function ensureTop3(items: string[], auxText: string): string[] {
  const out = items.slice(0, 3);
  if (out.length >= 3) return out;

  const seen = new Set(out.map(x => x.toLowerCase()));
  const addIfNew = (s: string) => {
    const k = s.toLowerCase();
    if (!seen.has(k) && s.trim()) { out.push(s.trim()); seen.add(k); }
  };

  // Try more list-style content
  for (const c of extractListItems(auxText)) {
    addIfNew(c); if (out.length === 3) return out;
  }

  // Fallback: split into sentences; use sufficiently informative ones
  const sentences = auxText
    .replace(/[\n\r]+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .filter(s => s.length > 30);
  for (const s of sentences) { addIfNew(s); if (out.length === 3) break; }

  while (out.length < 3) out.push("Add a targeted action based on data gaps.");
  return out;
}

/** Top-N insights ranked by frequency across brains, then by richness. */
function topInsights(blocks: string[], N = 5): string[] {
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

  if (ranked.length >= N) return ranked.slice(0, N);

  const unique: string[] = [];
  const seen = new Set(ranked.map(t => t.toLowerCase()));
  for (const b of blocks) {
    for (const it of extractListItems(b)) {
      const k = it.toLowerCase();
      if (!seen.has(k)) { unique.push(it); seen.add(k); }
      if (ranked.length + unique.length >= N) break;
    }
    if (ranked.length + unique.length >= N) break;
  }
  return ranked.concat(unique).slice(0, N);
}

/** Lightly vary repeated bold headlines so different brains don't read identical. */
function varyHeadline(text: string, brain: string, idx: number): string {
  // matches **Title**: rest
  const m = text.match(/^\s*\*\*(.+?)\*\*(\s*:\s*)?(.*)$/);
  if (!m) return text; // nothing to vary
  const title = m[1].trim();
  const after = m[3] || "";

  const verbs = [
    ["Reallocate", "Rebalance", "Reprioritize", "Shift"],
    ["Optimize", "Improve", "Refine", "Tune"],
    ["Develop", "Create", "Establish", "Build"],
    ["Implement", "Adopt", "Deploy", "Roll out"],
    ["Enhance", "Boost", "Strengthen", "Elevate"],
    ["Diversify", "Expand", "Broaden", "De-risk"],
    ["Prioritize", "Focus on", "Emphasize", "Champion"],
  ];

  const pick = (arr: string[]) => {
    const h = (brain.length + idx * 7 + title.length) % arr.length;
    return arr[h];
  };

  const tParts = title.split(/\s+/);
  const first = tParts[0];
  let replaced = title;

  for (const group of verbs) {
    if (group.some(v => v.toLowerCase() === first.toLowerCase())) {
      replaced = [pick(group), ...tParts.slice(1)].join(" ");
      break;
    }
  }

  // Add a subtle persona-flavor if still identical
  if (replaced === title) {
    const flavor: Record<string, string[]> = {
      CFO: ["Financial move:", "Spend strategy:", "Margin play:"],
      COO: ["Ops action:", "Process change:", "Efficiency step:"],
      CHRO: ["People action:", "Talent move:", "Culture step:"],
      CMO: ["Growth play:", "Campaign focus:", "Demand lever:"],
      CPO: ["Product bet:", "Roadmap move:", "Experience tweak:"],
    };
    const tag = (flavor[brain] || ["Action:"])[(brain.length + idx) % (flavor[brain]?.length || 1)];
    replaced = `${tag} ${title}`;
  }

  return `**${replaced}**: ${after}`.trim();
}

/* Inline Markdown component so list items render **bold** etc. without extra <p> */
function InlineMD({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({node, ...props}) => <span {...props} />,
      }}
    >
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
        {!isPaid && (
          <Link href="/payments" className="text-sm underline text-blue-300 hover:text-blue-200">
            Need full features? Upgrade
          </Link>
        )}
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
            <GroupedReport title={result.title || "Analysis Result"} md={result.summary || ""} />
          )}
        </div>
      )}
    </section>
  );
}

/* ---------------- Grouped report (Top 5 Insights + per-CXO exactly 3 varied recs) ---------------- */

function GroupedReport({ title, md }: { title: string; md: string }) {
  const normalized = normalizeAnalysis(md);
  const brains = parseBrains(normalized);

  const collectiveTop5 = topInsights(brains.map(b => b.insights || ""), 5);

  return (
    <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-900/70 text-zinc-100 space-y-4">
      <h3 className="font-semibold">{title}</h3>

      {collectiveTop5.length > 0 && (
        <details open className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <summary className="cursor-pointer text-lg font-medium select-none">Collective Insights (Top 5)</summary>
          <ol className="mt-3 list-decimal pl-6 space-y-1">
            {collectiveTop5.map((it, i) => (
              <li key={i} className="leading-7"><InlineMD text={it} /></li>
            ))}
          </ol>
        </details>
      )}

      <div className="space-y-3">
        <h4 className="text-base font-semibold opacity-90">Recommendations</h4>

        {brains.map((b, i) => {
          const base = extractListItems(b.recommendations || "");
          const top3 = ensureTop3(base, (b.insights || "") + "\n\n" + (b.recommendations || ""))
            .map((it, j) => varyHeadline(it, b.name, j));

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
