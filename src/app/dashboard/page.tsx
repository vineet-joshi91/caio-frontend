"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "(missing)";

type Me = { email: string; is_admin: boolean; is_paid: boolean };

function getToken(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch {}
  try { return localStorage.getItem("token"); } catch {}
  return null;
}

async function fetchWithDetail(input: RequestInfo, init?: RequestInit) {
  try {
    const res = await fetch(input, init);
    const text = await res.text();
    return { ok: res.ok, status: res.status, statusText: res.statusText, text };
  } catch (e: any) {
    // Network/CORS errors never reach user code; surface them here.
    return { ok: false, status: 0, statusText: "NETWORK", text: e?.message || "Failed to fetch" };
  }
}

export default function Dashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [profileErr, setProfileErr] = useState<string>("");
  const token = useMemo(getToken, []);

  useEffect(() => {
    (async () => {
      if (!token) { setProfileErr("No token — please log in again."); return; }
      if (API_BASE === "(missing)") { setProfileErr("NEXT_PUBLIC_API_BASE is missing."); return; }
      const r = await fetchWithDetail(`${API_BASE}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { setProfileErr(`/api/profile ${r.status} ${r.statusText} :: ${r.text}`); return; }
      try {
        const j = JSON.parse(r.text);
        setMe({ email: j.email, is_admin: !!j.is_admin, is_paid: !!j.is_paid });
      } catch {
        setProfileErr("Invalid JSON from /api/profile");
      }
    })();
  }, [token]);

  return (
    <main className="min-h-screen p-6 bg-black text-white">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="bg-white/10 p-6 rounded-xl">
          <h1 className="text-2xl mb-1">Welcome to CAIO</h1>
          {me ? (
            <p className="opacity-80">
              Logged in as <b>{me.email}</b> • {me.is_admin ? "Admin" : "User"} • {me.is_paid ? "Pro" : "Demo"}
            </p>
          ) : (
            <p className="text-red-300">{profileErr || "Loading..."}</p>
          )}
        </header>

        <AnalyzeCard token={token} isPaid={!!me?.is_paid} />
      </div>
    </main>
  );
}

// ---- Analyze card (inline component; uses multipart + handles Demo/Pro/NO_CREDITS) ----
function AnalyzeCard({ token, isPaid }: { token: string | null; isPaid: boolean }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const [jsonOut, setJsonOut] = useState<any>(null);
  const [rawOut, setRawOut] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [creditsMsg, setCreditsMsg] = useState<string>("");

  async function run() {
    setBusy(true);
    setErr("");
    setCreditsMsg("");
    setJsonOut(null);
    setRawOut("");

    try {
      if (!token) throw new Error("No token");
      if (!text.trim() && !file) throw new Error("Provide text or upload a file");

      const fd = new FormData();
      if (text.trim()) fd.append("text", text.trim());
      if (file) fd.append("file", file, file.name);

      const r = await fetchWithDetail(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }, // do NOT set Content-Type with FormData
        body: fd,
      });

      // Try to parse JSON either way
      let data: any = null;
      try { data = JSON.parse(r.text); } catch {}

      // Backend may return 402 with { error: "NO_CREDITS" }
      if (data?.error === "NO_CREDITS") {
        setCreditsMsg("Not enough credits to run Pro analysis. Add credits or try again later.");
        return;
      }

      if (!r.ok) {
        // Surface server detail to help us diagnose quickly
        throw new Error(`/api/analyze ${r.status} ${r.statusText} :: ${r.text}`);
      }

      if (data) setJsonOut(data);
      else setRawOut(r.text || "(empty)");
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
        {isPaid ? "Pro mode: full analysis (uses engines/LLM)."
                : "Demo mode: shows a realistic sample without spending credits."}
      </p>

      <textarea
        className="w-full h-28 p-2 rounded text-black"
        placeholder="Paste a short brief (optional if you upload a document)…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex items-center gap-3">
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        {file ? <span className="text-xs opacity-70">{file.name}</span> : null}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={busy || (!text.trim() && !file)}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? "Analyzing…" : "Analyze"}
        </button>
        <span className="text-xs opacity-60">API: {API_BASE}</span>
      </div>

      {creditsMsg && (
        <div className="rounded-md border border-yellow-600 bg-yellow-950/40 p-3 text-sm">
          {creditsMsg}
        </div>
      )}

      {err && (
        <pre className="rounded-md border border-red-700 bg-red-950/40 p-3 text-xs whitespace-pre-wrap">
          {err}
        </pre>
      )}

      {jsonOut && (
        <div className="space-y-2">
          {/* If backend returns our demo structure, this looks nice; if engines
              return a different shape, we still display the raw JSON below. */}
          {jsonOut.summary && (
            <div className="rounded-md border border-neutral-700 bg-neutral-900 p-3">
              <div className="text-sm font-medium mb-1">Summary</div>
              <div className="text-sm opacity-90">{jsonOut.summary}</div>
            </div>
          )}
          {jsonOut.cxo && typeof jsonOut.cxo === "object" && (
            <div className="rounded-md border border-neutral-700 bg-neutral-900 p-3">
              <div className="text-sm font-medium mb-2">CXO Actions</div>
              <ul className="text-sm list-disc pl-5 space-y-1">
                {Object.entries(jsonOut.cxo).map(([role, note]) => (
                  <li key={role}>
                    <b>{role}:</b> <span className="opacity-90">{String(note)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <pre className="rounded-md border border-neutral-700 bg-neutral-950 p-3 text-xs overflow-auto">
            {JSON.stringify(jsonOut, null, 2)}
          </pre>
        </div>
      )}

      {!jsonOut && rawOut && (
        <pre className="rounded-md border border-neutral-700 bg-neutral-950 p-3 text-xs overflow-auto">
          {rawOut}
        </pre>
      )}
    </section>
  );
}
