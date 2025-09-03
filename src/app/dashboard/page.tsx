"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Dashboard / CAIO
 * - Rich layout (header, input, brain selector, output, sticky export toolbar)
 * - Auth-aware (redirects to /login when token missing/expired)
 * - Analyze: POST /api/analyze (multipart FormData)
 * - Export:  POST /api/export/{pdf|docx} with { title, md_text }
 * - Handles 401/403/429 with clear UI feedback
 * - Usage-limit nudge for Free → Pro
 * - Collapsible "Last request" debug block
 */

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

// -----------------------------------------------------------------------------
// Auth helpers
// -----------------------------------------------------------------------------
function getAuthToken(): string | null {
  try {
    const cookie = document.cookie || "";
    const pick = (name: string) => cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1];
    // try common cookie keys first
    const c1 = pick("token");
    const c2 = pick("access_token");
    if (c1) return decodeURIComponent(c1);
    if (c2) return decodeURIComponent(c2);
  } catch {}
  try {
    const ls = localStorage.getItem("token") || localStorage.getItem("access_token");
    if (ls) return ls;
  } catch {}
  return null;
}

function clearAuthToken() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
  } catch {}
  // expire cookies
  document.cookie = `token=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `access_token=; Path=/; Max-Age=0; SameSite=Lax`;
}

async function withTimeout<T>(p: Promise<T>, ms = 60000): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("Network timeout")), ms)),
  ]);
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
type AnalyzeOK = {
  status: "ok";
  title: string;
  summary: string;
  provider?: string;
  brains?: string[];
  chars?: number;
};
type AnalyzeDemo = { status: "demo"; title: string; summary: string; tip?: string };
type AnalyzeError = { status: "error"; title: string; message: string; action?: string };
type AnalyzeResult = AnalyzeOK | AnalyzeDemo | AnalyzeError;

type BrainKey = "CFO" | "CHRO" | "COO" | "CMO" | "CPO";

const ALL_BRAINS: BrainKey[] = ["CFO", "CHRO", "COO", "CMO", "CPO"];

// -----------------------------------------------------------------------------
// Helpers: markdown prettify (for on-screen display only)
// -----------------------------------------------------------------------------
function normalizeTitle(s: string): string {
  return (s || "CAIO Brief").toString().replace(/[^\w\s-]+/g, "").slice(0, 60) || "CAIO Brief";
}

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// -----------------------------------------------------------------------------
// Main Page
// -----------------------------------------------------------------------------
export default function DashboardPage() {
  // Auth & profile
  const [token, setToken] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState<boolean>(false);

  // Inputs
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedBrains, setSelectedBrains] = useState<BrainKey[]>(["CFO", "COO", "CHRO", "CMO", "CPO"]);

  // UI state
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState<null | "pdf" | "docx">(null);
  const [friendlyErr, setFriendlyErr] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  // Debug
  const [debugOpen, setDebugOpen] = useState(false);
  const [lastReq, setLastReq] = useState<{ url: string; status?: string; body?: string; error?: string } | null>(null);

  // Boot: token + profile
  useEffect(() => {
    const t = getAuthToken();
    setToken(t);
    if (!t) {
      // no token → go to login
      window.location.assign("/login");
      return;
    }
    (async () => {
      try {
        const r = await withTimeout(fetch(`${API_BASE}/api/profile`, { headers: { Authorization: `Bearer ${t}` } }), 20000);
        if (r.ok) {
          const j = await r.json();
          setIsPaid(!!j?.is_paid);
        } else if (r.status === 401) {
          clearAuthToken();
          window.location.assign("/login");
        }
      } catch {
        // silent; user can still try demo/analyze and see messaging
      }
    })();
  }, []);

  // Brain selector
  const toggleBrain = useCallback((b: BrainKey) => {
    setSelectedBrains((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
  }, []);

  // Inputs
  const onBrowseClick = () => fileInputRef.current?.click();
  const onFileChosen = (f: File | null) => setFile(f || null);
  const clearInputs = () => {
    setText("");
    setFile(null);
  };

  // Analyze action
  const run = useCallback(async () => {
    setBusy(true);
    setFriendlyErr(null);
    setResult(null);
    try {
      if (!text.trim() && !file) throw new Error("Enter text or upload a file.");
      const fd = new FormData();
      if (text.trim()) fd.append("text", text.trim());
      if (file) fd.append("file", file);
      if (selectedBrains.length) fd.append("brains", selectedBrains.join(","));

      const url = `${API_BASE}/api/analyze`;
      const res = await withTimeout(
        fetch(url, {
          method: "POST",
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: fd,
        }),
        120000
      );

      const raw = await res.text();
      setLastReq({ url, status: `${res.status}`, body: raw?.slice(0, 2000) });

      let parsed: any = {};
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        parsed = {};
      }

      if (res.status === 401) {
        clearAuthToken();
        window.location.assign("/login");
        return;
      }
      if (res.status === 429) {
        setResult({
          status: "error",
          title: "Limit reached",
          message: "Free daily limit reached. Upgrade to Pro to continue.",
          action: "Go to Payments",
        });
        return;
      }
      if (!res.ok) {
        const message = parsed?.detail || parsed?.message || "Analysis failed. Please try again.";
        setResult({ status: "error", title: "Analysis Unavailable", message });
        return;
      }

      if (parsed?.status === "demo") {
        setResult({
          status: "demo",
          title: parsed?.title ?? "Demo Result",
          summary: parsed?.summary ?? "",
          tip: parsed?.tip ?? "",
        });
        return;
      }

      setResult({
        status: "ok",
        title: parsed?.title ?? "Analysis Result",
        summary: parsed?.summary ?? "",
        provider: parsed?.provider,
        brains: parsed?.brains ?? [],
        chars: parsed?.chars ?? 0,
      });
    } catch (e: any) {
      setFriendlyErr(e?.message || "Something went wrong. Please try again.");
      setLastReq((prev) => ({ ...(prev || { url: `${API_BASE}/api/analyze` }), error: e?.message || String(e) }));
    } finally {
      setBusy(false);
    }
  }, [API_BASE, token, text, file, selectedBrains]);

  // Export helpers
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

  const exportBrief = useCallback(
    async (fmt: "pdf" | "docx") => {
      if (!result || result.status === "error") return;
      if (!isPaid) {
        window.location.assign("/payments");
        return;
      }
      const title = normalizeTitle(result.title);
      const markdown = (result.status === "ok" || result.status === "demo" ? result.summary : "") || "";
      if (!markdown.trim()) {
        setFriendlyErr("Nothing to export yet. Run an analysis first.");
        return;
      }

      setExportBusy(fmt);
      setFriendlyErr(null);
      const url = `${API_BASE}/api/export/${fmt}`;

      try {
        const res = await withTimeout(
          fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ title, md_text: markdown }),
          }),
          60000
        );

        setLastReq({ url, status: `${res.status}`, body: `{ title: "${title}", md_text: "...${markdown.slice(0, 60)}" }` });

        if (res.status === 401) {
          clearAuthToken();
          window.location.assign("/login");
          return;
        }
        if (res.status === 403) {
          setFriendlyErr("Export is for Pro accounts. Please upgrade to continue.");
          return;
        }
        if (res.status === 405) {
          setFriendlyErr("Export endpoint method not allowed. Backend may be outdated.");
          return;
        }
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `Export ${fmt} failed`);
        }
        const blob = await res.blob();
        downloadBlob(`${title}.${fmt === "pdf" ? "pdf" : "docx"}`, blob);
      } catch (e: any) {
        setFriendlyErr(e?.message || "Export failed. Please try again.");
        setLastReq((prev) => ({ ...(prev || { url }), error: e?.message || String(e) }));
      } finally {
        setExportBusy(null);
      }
    },
    [API_BASE, token, isPaid, result]
  );

  // Derive hints
  const isAnalyzeDisabled = useMemo(() => busy || (!text.trim() && !file), [busy, text, file]);

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CAIO Dashboard</h1>
          <p className="text-sm text-zinc-400">Chief Artificial Intelligence Officer · Multi-brain analysis</p>
        </div>
        <div className="text-xs md:text-sm opacity-80">
          API_BASE:{" "}
          <a className="underline" href={API_BASE} target="_blank" rel="noreferrer">
            {API_BASE}
          </a>
        </div>
      </header>

      {/* Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input + brains */}
        <section className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950">
            <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium">Paste text or upload a file</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearInputs}
                  className="text-xs rounded-md border border-zinc-800 px-2 py-1 hover:bg-zinc-900"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="p-4">
              <textarea
                className="w-full rounded-md bg-zinc-900 border border-zinc-800 p-3 outline-none min-h-[180px]"
                placeholder="Paste your content (financials, SOPs, plans) or upload a document..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onBrowseClick}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
                >
                  or browse files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".txt,.md,.csv,.tsv,.pdf,.docx,.xlsx,.xls"
                  onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
                />
                {file && <span className="text-xs opacity-80">Selected: {file.name}</span>}
              </div>

              {/* Brain selector */}
              <div className="mt-4">
                <p className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Brains</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_BRAINS.map((b) => {
                    const active = selectedBrains.includes(b);
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => toggleBrain(b)}
                        className={clsx(
                          "px-3 py-1.5 rounded-lg text-sm border",
                          active ? "bg-emerald-700/20 border-emerald-700" : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                        )}
                        aria-pressed={active}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Run */}
              <div className="mt-5">
                <button
                  onClick={run}
                  disabled={isAnalyzeDisabled}
                  className={clsx(
                    "px-4 py-2 rounded-lg",
                    isAnalyzeDisabled ? "bg-emerald-700/40 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500"
                  )}
                >
                  {busy ? "Analyzing..." : "Run analysis"}
                </button>
              </div>
            </div>
          </div>

          {/* Friendly error */}
          {friendlyErr && (
            <div className="mt-4 rounded-md border border-red-700 bg-red-900/30 p-3 text-sm">
              {friendlyErr}
            </div>
          )}

          {/* Output */}
          {result && (
            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{result.title || "Analysis Result"}</h2>
                  {"provider" in result && result.provider && (
                    <p className="text-xs text-zinc-400">Provider: {result.provider}</p>
                  )}
                </div>

                {/* Sticky export toolbar */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportBrief("pdf")}
                    disabled={!isPaid || exportBusy === "pdf"}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60"
                  >
                    {exportBusy === "pdf" ? "Exporting..." : "Export PDF"}
                  </button>
                  <button
                    onClick={() => exportBrief("docx")}
                    disabled={!isPaid || exportBusy === "docx"}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60"
                  >
                    {exportBusy === "docx" ? "Exporting..." : "Export DOCX"}
                  </button>
                  {!isPaid && (
                    <Link href="/payments" className="text-sm underline text-blue-300 hover:text-blue-200">
                      Upgrade to export
                    </Link>
                  )}
                </div>
              </div>

              <div className="p-4 prose prose-invert max-w-none">
                {"summary" in result && (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary || ""}</ReactMarkdown>
                )}
                {result.status === "error" && (
                  <div className="text-sm">
                    <p className="font-medium text-red-300">{result.message}</p>
                    {result.action && (
                      <p className="mt-2">
                        <Link href="/payments" className="underline">
                          {result.action}
                        </Link>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right: tips & debug */}
        <aside className="lg:col-span-1 space-y-6">
          {/* Tier card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="text-sm font-medium mb-2">Account</h3>
            <div className="text-sm">
              <div>
                Status:{" "}
                <span className={clsx("px-2 py-0.5 rounded-md text-xs", isPaid ? "bg-emerald-800/30" : "bg-zinc-800")}>
                  {isPaid ? "Pro" : "Free (Demo limits apply)"}
                </span>
              </div>
              {!isPaid && (
                <div className="mt-2">
                  <Link href="/payments" className="underline text-blue-300 hover:text-blue-200">
                    Upgrade for unlimited analysis & export
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="text-sm font-medium mb-2">Tips</h3>
            <ul className="list-disc pl-6 text-sm space-y-1">
              <li>Upload P&L, cashflow, hiring data, SOPs, campaign plans, or goals.</li>
              <li>Toggle brains to focus the brief (CFO/CHRO/COO/CMO/CPO).</li>
              <li>Use Pro to export polished PDF/DOCX reports.</li>
            </ul>
          </div>

          {/* Debug */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950">
            <button
              type="button"
              onClick={() => setDebugOpen((s) => !s)}
              className="w-full px-4 py-3 text-left border-b border-zinc-800"
            >
              <span className="text-sm font-medium">Last request</span>
              <span className="text-xs ml-2 opacity-60">(for troubleshooting)</span>
            </button>
            {debugOpen && (
              <div className="p-4 text-xs space-y-2">
                <div>
                  <span className="opacity-60">URL: </span>
                  <span className="break-all">{lastReq?.url || "-"}</span>
                </div>
                <div>
                  <span className="opacity-60">Status: </span>
                  <span>{lastReq?.status || "-"}</span>
                </div>
                <div className="opacity-60">Body / Message:</div>
                <pre className="whitespace-pre-wrap break-words max-h-56 overflow-auto bg-black/30 p-2 rounded">
                  {lastReq?.body || lastReq?.error || "-"}
                </pre>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
