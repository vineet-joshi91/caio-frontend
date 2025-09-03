"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ---- Config -----------------------------------------------------------------
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

// ---- Auth helpers ------------------------------------------------------------
function getAuthToken(): string | null {
  try {
    // cookie first
    const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (m?.[1]) return decodeURIComponent(m[1]);
  } catch {}
  try {
    // then localStorage
    const v = localStorage.getItem("token");
    if (v) return v;
  } catch {}
  return null;
}

function clearAuthToken() {
  try {
    localStorage.removeItem("token");
  } catch {}
  document.cookie = `token=; Path=/; Max-Age=0; SameSite=Lax`;
}

async function withTimeout<T>(p: Promise<T>, ms = 60000): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("Network timeout")), ms)),
  ]);
}

// ---- Types -------------------------------------------------------------------
type AnalyzeResult =
  | { status: "ok"; title: string; summary: string; provider?: string; brains?: string[]; chars?: number }
  | { status: "demo"; title: string; summary: string; tip?: string }
  | { status: "error"; title: string; message: string; action?: string };

type BusyState = boolean;

// ---- Page --------------------------------------------------------------------
export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [busy, setBusy] = useState<BusyState>(false);
  const [exportBusy, setExportBusy] = useState<null | "pdf" | "docx">(null);
  const [friendlyErr, setFriendlyErr] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = getAuthToken();
    setToken(t);
    // get profile to determine Pro/Free
    if (t) {
      (async () => {
        try {
          const r = await withTimeout(
            fetch(`${API_BASE}/api/profile`, { headers: { Authorization: `Bearer ${t}` } }),
            20000
          );
          if (r.ok) {
            const j = await r.json();
            setIsPaid(!!j?.is_paid);
          } else if (r.status === 401) {
            clearAuthToken();
            window.location.assign("/login");
          }
        } catch {
          // silent—UI will still work for demo
        }
      })();
    } else {
      // no token, go to login
      window.location.assign("/login");
    }
  }, []);

  function onBrowseClick() {
    fileInputRef.current?.click();
  }
  function onFileChosen(f: File | null) {
    setFile(f || null);
  }

  async function run() {
    setBusy(true);
    setFriendlyErr(null);
    setResult(null);
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
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        parsed = {};
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
    } finally {
      setBusy(false);
    }
  }

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
      // nudge to upgrade
      window.location.assign("/payments");
      return;
    }

    const title =
      (result.title || "CAIO Brief").toString().replace(/[^\w\s-]+/g, "").slice(0, 60) || "CAIO Brief";
    const markdown = (result.status === "ok" || result.status === "demo" ? result.summary : "") || "";
    if (!markdown.trim()) {
      setFriendlyErr("Nothing to export yet. Run an analysis first.");
      return;
    }

    setExportBusy(fmt);
    setFriendlyErr(null);

    try {
      const res = await withTimeout(
        fetch(`${API_BASE}/api/export/${fmt}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          // backend accepts md_text or markdown; send md_text
          body: JSON.stringify({ title, md_text: markdown }),
        }),
        60000
      );

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
    } finally {
      setExportBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">CAIO Dashboard</h1>
        <div className="text-sm opacity-80">
          API_BASE: <span className="underline">{API_BASE}</span>
        </div>
      </header>

      {/* Input form */}
      <div className="rounded-xl border border-zinc-800 p-4">
        <label className="block text-sm mb-2">Paste text</label>
        <textarea
          className="w-full rounded-md bg-zinc-900 border border-zinc-800 p-3 outline-none"
          rows={8}
          placeholder="Paste your content or upload a file..."
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
            onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
          />
          {file && <span className="text-xs opacity-80">Selected: {file.name}</span>}
        </div>

        <div className="mt-4">
          <button
            onClick={run}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
          >
            {busy ? "Analyzing..." : "Run analysis"}
          </button>
        </div>
      </div>

      {/* Errors */}
      {friendlyErr && (
        <div className="mt-4 rounded-md border border-red-700 bg-red-900/30 p-3 text-sm">
          {friendlyErr}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-6 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{result.title || "Analysis Result"}</h2>
            {/* Export toolbar */}
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
          <div className="mt-3 prose prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {("summary" in result && result.summary) ? result.summary : ""}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
