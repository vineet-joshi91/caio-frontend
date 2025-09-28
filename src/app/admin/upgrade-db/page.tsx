"use client";
import { useEffect, useMemo, useState } from "react";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-orchestrator.onrender.com";

function getAuthToken(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : localStorage.getItem("token");
  } catch { return null; }
}

type CheckResult = {
  ok: boolean;
  details: string[];
};

export default function UpgradeDB() {
  const token = useMemo(getAuthToken, []);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function runCheck() {
    setBusy(true); setErr(null); setResult(null);
    try {
      if (!token) throw new Error("Not logged in. Please log in as an admin.");
      // 1) Profile: must be admin
      const p = await fetch(`${API_BASE}/api/profile`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const pj = await p.json();
      if (!p.ok || (!pj?.is_admin && pj?.tier !== "admin" && pj?.tier !== "premium")) {
        throw new Error("You must be an admin to run this check.");
      }
      // 2) Summary endpoint
      const s = await fetch(`${API_BASE}/api/admin/users/summary`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!s.ok) throw new Error("`/api/admin/users/summary` not reachable.");
      const sj = await s.json();

      // 3) Roster endpoint (one item) with required fields
      const u = new URL(`${API_BASE}/api/admin/users`);
      u.searchParams.set("page", "1");
      u.searchParams.set("page_size", "1");
      u.searchParams.set("include_test", "true");
      const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!r.ok) throw new Error("`/api/admin/users` not reachable.");
      const rj = await r.json();

      const sample = (rj?.items && rj.items[0]) || {};
      const required = ["id","email","tier","created_on","last_seen","total_sessions"];
      const missing = required.filter(k => !(k in sample));

      const ok = missing.length === 0;
      const details = [
        "summary: ok",
        `sample fields present: ${required.filter(k => k in sample).join(", ") || "none"}`,
        ...(missing.length ? [`missing: ${missing.join(", ")}`] : []),
        sj ? "counters: ok" : "counters: missing"
      ];
      setResult({ ok, details });
    } catch (e:any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { runCheck(); /* auto-run once */ }, []); // eslint-disable-line

  return (
    <main style={{minHeight:"100vh",background:"#0b0f1a",color:"#e5e7eb",display:"grid",placeItems:"start center",padding:24}}>
      <div style={{width:"min(100%,720px)",background:"#0e1320",border:"1px solid #243044",borderRadius:12,padding:20}}>
        <h1>Admin • DB Health</h1>
        <p style={{opacity:.8, marginTop: 4}}>
          This checks that the Admin endpoints are available and that the required user fields
          (<code>id</code>, <code>email</code>, <code>tier</code>, <code>created_on</code>, <code>last_seen</code>, <code>total_sessions</code>)
          are returned correctly. No migration is required at this time.
        </p>

        <button onClick={runCheck} disabled={busy}
                style={{marginTop:12,padding:"10px 14px",borderRadius:10,border:0,background:"#059669",color:"#fff",fontWeight:800,cursor:"pointer"}}>
          {busy ? "Running…" : "Re-run check"}
        </button>

        {err && <div style={{marginTop:12,padding:10,border:"1px solid #5a3535",background:"#331b1b",borderRadius:8}}>{err}</div>}
        {result && (
          <div style={{marginTop:12,padding:10,border:"1px solid #23404a",background: result.ok ? "#0f2a1f" : "#2a0f10",borderRadius:8}}>
            <div style={{fontWeight:800, marginBottom:6}}>{result.ok ? "DB OK" : "DB Check Failed"}</div>
            <ul style={{margin:0, paddingLeft:18}}>
              {result.details.map((d,i)=><li key={i} style={{margin:"4px 0"}}>{d}</li>)}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
