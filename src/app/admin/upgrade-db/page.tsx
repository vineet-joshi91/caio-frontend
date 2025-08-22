"use client";
import { useState } from "react";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

export default function UpgradeDB() {
  const [token, setToken] = useState("");
  const [out, setOut] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function getAuthToken(): string | null {
    try {
      const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : localStorage.getItem("token");
    } catch { return null; }
  }

  async function run() {
    setOut(null); setErr(null); setBusy(true);
    try {
      const auth = getAuthToken();
      if (!auth) { setErr("Not logged in. Please log in as an admin."); return; }
      if (!token.trim()) { setErr("Enter the X-Admin-Token."); return; }

      const r = await fetch(`${API_BASE}/api/admin/maintenance/upgrade-db`, {
        method: "POST",
        headers: {
          "X-Admin-Token": token.trim(),
          "Authorization": `Bearer ${auth}`,
        },
      });
      const j = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(j?.detail || `HTTP ${r.status}`);
      setOut(JSON.stringify(j, null, 2));
    } catch (e:any) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <main style={{minHeight:"100vh",background:"#0b0f1a",color:"#e5e7eb",display:"grid",placeItems:"start center",padding:24}}>
      <div style={{width:"min(100%,720px)",background:"#0e1320",border:"1px solid #243044",borderRadius:12,padding:20}}>
        <h1>Admin • Upgrade DB</h1>
        <p style={{opacity:.8}}>This runs one-time ALTERs to add <code>subscription_id</code> and <code>plan_status</code>.</p>

        <label style={{display:"grid",gap:6,marginTop:12}}>
          <span>Enter X‑Admin‑Token</span>
          <input value={token} onChange={e=>setToken(e.target.value)}
                 style={{padding:"10px 12px",borderRadius:10,border:"1px solid #2b3650",background:"#0f172a",color:"#e5e7eb"}} />
        </label>

        <button onClick={run} disabled={busy}
                style={{marginTop:12,padding:"10px 14px",borderRadius:10,border:0,background:"#059669",color:"#fff",fontWeight:800,cursor:"pointer"}}>
          {busy ? "Running…" : "Run upgrade"}
        </button>

        {err && <div style={{marginTop:12,padding:10,border:"1px solid #5a3535",background:"#331b1b",borderRadius:8}}>{err}</div>}
        {out && <pre style={{marginTop:12,whiteSpace:"pre-wrap",wordBreak:"break-word",background:"#0d1220",border:"1px solid #23304a",borderRadius:8,padding:10,fontSize:12}}>{out}</pre>}
      </div>
    </main>
  );
}
