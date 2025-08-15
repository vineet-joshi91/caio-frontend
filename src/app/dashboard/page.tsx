"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "(missing)";

type Me = { email: string; is_admin: boolean; is_paid: boolean; created_at?: string };

function withTimeout<T>(p: Promise<T>, ms = 12000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

function getToken(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch {}
  try { return localStorage.getItem("token"); } catch {}
  return null;
}

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<{busy:boolean; err?:string}>({busy:true});

  const token = useMemo(getToken, []);

  useEffect(() => {
    (async () => {
      if (!token) { setState({busy:false, err:"No token found. Please log in again."}); return; }
      if (API_BASE === "(missing)") { setState({busy:false, err:"NEXT_PUBLIC_API_BASE is missing on the frontend host."}); return; }
      try {
        const r = await withTimeout(fetch(`${API_BASE}/api/profile`, { headers: { Authorization: `Bearer ${token}` }}), 12000);
        if (!r.ok) {
          const t = await r.text().catch(()=> "");
          throw new Error(`/api/profile ${r.status} ${r.statusText} :: ${t}`);
        }
        const j = await r.json();
        setMe({ email:j.email, is_admin:!!j.is_admin, is_paid:!!j.is_paid, created_at:j.created_at });
        setState({busy:false});
      } catch (e:any) {
        setState({busy:false, err: e?.message || "Failed to load profile"});
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.busy) {
    return <main className="min-h-screen flex items-center justify-center bg-black text-white">Loading…</main>;
  }

  if (state.err) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="max-w-xl w-full bg-white/10 p-6 rounded-xl">
          <h1 className="text-xl mb-3">Dashboard error</h1>
          <pre className="text-xs whitespace-pre-wrap">{state.err}</pre>
          <div className="text-sm opacity-75 mt-3">
            <div><b>API_BASE:</b> {API_BASE}</div>
            <div><b>Token present:</b> {token ? "yes" : "no"}</div>
            <p className="mt-2">Open <a className="underline" href="/diagnostics">/diagnostics</a> for details.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 bg-black text-white">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="bg-white/10 p-6 rounded-xl">
          <h1 className="text-2xl mb-1">Welcome to CAIO</h1>
          <p className="opacity-80">
            Logged in as <b>{me?.email}</b> • {me?.is_admin ? "Admin" : "User"} • {me?.is_paid ? "Pro" : "Demo"}
          </p>
        </header>
        <section className="bg-white/10 p-6 rounded-xl">
          <h2 className="text-xl mb-3">Quick analyze</h2>
          <Analyzer />
        </section>
      </div>
    </main>
  );
}

function Analyzer() {
  const [text, setText] = useState("");
  const [out, setOut] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <textarea className="w-full h-28 p-2 rounded text-black" value={text} onChange={e=>setText(e.target.value)} placeholder="Paste a short note…" />
      <button className="mt-3 px-4 py-2 rounded bg-blue-600 disabled:opacity-60" disabled={busy} onClick={async ()=>{
        setBusy(true); setErr(""); setOut("");
        try {
          const token = getToken();
          if (!token) throw new Error("Missing token");
          if (!text.trim()) throw new Error("Enter some text first");
          const fd = new FormData(); fd.append("text", text.trim());
          const r = await withTimeout(fetch(`${API_BASE}/api/analyze`, { method:"POST", headers:{ Authorization:`Bearer ${token}` }, body: fd }), 20000);
          if (!r.ok) { const t = await r.text().catch(()=> ""); throw new Error(`/api/analyze ${r.status} ${r.statusText} :: ${t}`); }
          setOut(JSON.stringify(await r.json(), null, 2));
        } catch(e:any) {
          setErr(e?.message || "Analyze failed");
        } finally {
          setBusy(false);
        }
      }}>{busy ? "Analyzing…" : "Analyze"}</button>
      {err && <p className="text-red-300 mt-3">{err}</p>}
      {out && <pre className="mt-3 text-xs bg-black/60 p-3 rounded max-h-80 overflow-auto">{out}</pre>}
    </div>
  );
}
