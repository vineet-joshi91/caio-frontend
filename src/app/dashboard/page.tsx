"use client";

import { useEffect, useMemo, useState } from "react";
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
          const txt = await res.text().catch(() => "");
          throw new Error(`Profile ${res.status}: ${txt || res.statusText}`);
        }
        const j = await res.json();
        setMe({ email: j.email, is_admin: !!j.is_admin, is_paid: !!j.is_paid, created_at: j.created_at });
      } catch (e: any) {
        setErr(e?.message || "Failed to load profile");
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
      <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="bg-white/10 p-6 rounded-xl text-center">
          <h1 className="text-2xl mb-2">Dashboard</h1>
          <p className="opacity-80 mb-4">You’re not logged in.</p>
          <Link href="/signup" className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500">Go to Login</Link>
        </div>
      </main>
    );
  }

  if (busy) {
    return <main className="min-h-screen flex items-center justify-center bg-black text-white">Loading…</main>;
  }

  if (err) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="bg-white/10 p-6 rounded-xl">
          <h1 className="text-xl mb-2">Dashboard</h1>
          <p className="text-red-300">{err}</p>
          <div className="mt-3 flex gap-2">
            <Link href="/signup" className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm">Re-login</Link>
            <button onClick={() => router.refresh()} className="px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-sm">Retry</button>
            <button onClick={logout} className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-sm">Logout</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 bg-black text-white">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="bg-white/10 p-6 rounded-xl">
          <h1 className="text-2xl mb-1">Dashboard</h1>
          <p className="opacity-80">
            Logged in as <b>{me?.email}</b> • {me?.is_admin ? "Admin" : "User"} • {me?.is_paid ? "Pro" : "Demo"}
          </p>
          <div className="mt-3 flex gap-2">
            {!me?.is_paid && (
              <Link href="/payments" className="underline text-blue-300">
                Upgrade to Pro
              </Link>
            )}
            <button onClick={logout} className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-sm">
              Logout
            </button>
          </div>
        </header>

        {/* Analyze */}
        <AnalyzeCard token={token} />
      </div>
    </main>
  );
}

function AnalyzeCard({ token }: { token: string }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [out, setOut] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true); setErr(null); setOut(null);
    try {
      if (!token) throw new Error("No token");
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
        const txt = await res.text().catch(() => "");
        throw new Error(`Analyze ${res.status}: ${txt || res.statusText}`);
      }
      const j = await res.json();
      setOut(JSON.stringify(j, null, 2));
    } catch (e: any) {
      setErr(e?.message || "Analyze failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white/10 p-6 rounded-xl space-y-4">
      <h2 className="text-xl">Quick analyze</h2>
      <p className="text-sm opacity-70">
        Paste a short brief and/or upload a document (PDF, DOCX, TXT…). In Demo, output is limited.
      </p>

      <textarea
        className="w-full h-28 p-2 rounded text-black"
        placeholder="Paste a short business note to test…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex items-center gap-3 text-sm">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block"
        />
        {file && <span className="opacity-80">Selected: {file.name}</span>}
      </div>

      <button
        onClick={run}
        disabled={busy}
        className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
      >
        {busy ? "Analyzing…" : "Analyze"}
      </button>

      {err && <p className="text-red-300">{err}</p>}
      {out && (
        <pre className="mt-3 bg-black/60 p-3 rounded max-h-96 overflow-auto text-xs">
          {out}
        </pre>
      )}
      <p className="text-xs opacity-60">API: {API_BASE}</p>
    </section>
  );
}
