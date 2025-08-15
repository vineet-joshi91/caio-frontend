"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

export default function DashLite() {
  const [status, setStatus] = useState("Loading...");
  const [profile, setProfile] = useState<any>(null);
  const [text, setText] = useState("");
  const [out, setOut] = useState<string>("");

  function getToken(): string | null {
    try {
      const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
      if (m) return decodeURIComponent(m[1]);
    } catch {}
    try { return localStorage.getItem("token"); } catch {}
    return null;
  }

  useEffect(() => {
    (async () => {
      try {
        const token = getToken();
        if (!token) { setStatus("No token; go to / to login"); return; }

        const r = await fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await r.text();
        if (!r.ok) { setStatus(`/api/profile ${r.status} :: ${body}`); return; }
        setProfile(JSON.parse(body));
        setStatus("Ready");
      } catch (e: any) {
        setStatus(`Error: ${e?.message || e}`);
      }
    })();
  }, []);

  async function runAnalyze() {
    setOut("Running…");
    try {
      const token = getToken();
      if (!token) { setOut("No token"); return; }
      const fd = new FormData();
      fd.append("text", text || "Quarterly revenue fell 8% while CAC rose 15%. Give CFO/CMO actions.");
      const r = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const body = await r.text();
      if (!r.ok) { setOut(`/api/analyze ${r.status} :: ${body}`); return; }
      setOut(body);
    } catch (e: any) {
      setOut(`Error: ${e?.message || e}`);
    }
  }

  return (
    <main className="min-h-screen p-6 bg-black text-white">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl">DashLite</h1>
        <p className="opacity-80 text-sm">Status: {status}</p>
        {profile && (
          <div className="bg-white/10 p-4 rounded">
            <div><b>Email:</b> {profile.email}</div>
            <div><b>Admin:</b> {String(profile.is_admin)}</div>
            <div><b>Paid:</b> {String(profile.is_paid)}</div>
          </div>
        )}
        <div className="bg-white/10 p-4 rounded">
          <h2 className="text-lg mb-2">Quick analyze</h2>
          <textarea className="w-full h-24 p-2 rounded text-black"
            value={text} onChange={e=>setText(e.target.value)}
            placeholder="Type some text or leave blank to use default demo prompt..." />
          <button className="mt-3 px-4 py-2 rounded bg-blue-600" onClick={runAnalyze}>Analyze</button>
          {out && <pre className="mt-3 text-xs bg-black/60 p-3 rounded max-h-80 overflow-auto">{out}</pre>}
        </div>
      </div>
    </main>
  );
}
