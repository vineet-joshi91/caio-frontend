"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;
const NETLIFY_HOME = "https://caioai.netlify.app";

type Me = {
  email: string;
  is_admin: boolean;
  is_paid: boolean;
  created_at?: string;
};

function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const token = useMemo(() => getAuthToken(), []);
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) { setBusy(false); return; }
      try {
        const res = await withTimeout(fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }), 12000);
        if (!res.ok) {
          throw new Error("Couldn’t load your profile. Please log in again.");
        }
        const j = await res.json();
        setMe({ email: j.email, is_admin: !!j.is_admin, is_paid: !!j.is_paid, created_at: j.created_at });
      } catch (e: any) {
        setErr(e?.message || "Something went wrong.");
      } finally {
        setBusy(false);
      }
    })();
  }, [token]);

  function logout() {
    try {
      document.cookie = "token=; path=/; max-age=0; SameSite=Lax";
      try { localStorage.removeItem("token"); } catch {}
    } catch {}
    window.location.assign(NETLIFY_HOME); // same tab
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-6">
        <div className="bg-zinc-900/70 p-6 rounded-2xl text-center shadow-xl border border-zinc-800">
          <h1 className="text-2xl mb-2">Dashboard</h1>
          <p className="opacity-80 mb-4">You’re not logged in.</p>
          <Link href="/signup" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500">
            Go to Login
          </Link>
        </div>
      </main>
    );
  }

  if (busy) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="animate-pulse opacity-80">Loading…</div>
      </main>
    );
  }

  if (err) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-6">
        <div className="bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800">
          <h1 className="text-xl mb-2">Dashboard</h1>
          <p className="text-red-300">{err}</p>
          <div className="mt-3 flex gap-2">
            <Link href="/signup" className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm">Re‑login</Link>
            <button onClick={() => router.refresh()} className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm">Retry</button>
            <button onClick={logout} className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-sm">Logout</button>
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
                Logged in as <b>{me?.email}</b> • {me?.is_admin ? "Admin" : "User"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs tracking-wide border ${me?.is_paid ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200" : "bg-amber-500/15 border-amber-400/40 text-amber-200"}`}>
                {me?.is_paid ? "Pro" : "Demo"}
              </span>
              <button onClick={logout} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm shadow">
                Logout
              </button>
            </div>
          </div>
          {!me?.is_paid && (
            <div className="mt-3">
              <Link href="/payments" className="inline-block text-blue-300 underline hover:text-blue-200">
                Upgrade to Pro
              </Link>
            </div>
          )}
        </header>

        {/* Analyze */}
        <AnalyzeCard token={token} />
      </div>
    </main>
  );
}

/* ==== Analyze Card with Drag-and-Drop (no internal URLs shown) ==== */
function AnalyzeCard({ token }: { token: string }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [out, setOut] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  function onBrowseClick() {
    fileInputRef.current?.click();
  }
  function onFileChosen(f: File | undefined | null) {
    if (!f) return;
    setFile(f);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); setDragActive(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }

  async function run() {
    setBusy(true); setErr(null); setOut(null);
    try {
      if (!token) throw new Error("Please log in again.");
      const fd = new FormData();
      if (text.trim()) fd.append("text", text.trim());
      if (file) fd.append("file", file);
      if (!text.trim() && !file) throw new Error("Enter text or upload a file.");

      const res = await withTimeout(fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      }), 30000);

      if (!res.ok) {
        // show friendly message without exposing backend details
        throw new Error("Analyze failed. Please try again in a moment.");
      }
      const j = await res.json();
      setOut(JSON.stringify(j, null, 2));
    } catch (e: any) {
      setErr(e?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-zinc-900/70 p-6 rounded-2xl shadow-xl border border-zinc-800 space-y-5">
      <h2 className="text-xl font-semibold">Quick analyze</h2>

      {/* Dropzone */}
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
          <button
            type="button"
            onClick={onBrowseClick}
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
        {!false && ( // keep a subtle upsell without exposing details
          <Link href="/payments" className="text-sm underline text-blue-300 hover:text-blue-200">
            Need full features? Upgrade
          </Link>
        )}
      </div>

      {/* Output */}
      {err && <p className="text-red-300">{err}</p>}
      {out && (
        <pre className="mt-3 bg-zinc-950/70 p-4 rounded-xl max-h-[28rem] overflow-auto text-xs leading-relaxed border border-zinc-800">
          {out}
        </pre>
      )}
    </section>
  );
}
