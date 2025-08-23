"use client";
import { useEffect, useState } from "react";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

type Metrics = {
  active_total: number;
  active_inr: number | null;
  active_usd: number | null;
  cancelled_7d: number;
  mrr: Record<string, number>;
};

type U = {
  id: number; email: string; is_admin: boolean; is_active: boolean;
  is_paid: boolean; subscription_id?: string | null; plan_status?: string | null; created_at?: string | null;
};

export default function AdminUsers() {
  const [items, setItems] = useState<U[]>([]);
  const [metrics, setMetrics] = useState<Metrics| null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function getToken(): string | null {
    try {
      const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : localStorage.getItem("token");
    } catch { return null; }
  }

  useEffect(() => {
    (async () => {
      setErr(null); setLoading(true);
      try {
        const token = getToken();
        if (!token) { window.location.href="/login"; return; }

        const [ur, mr] = await Promise.all([
          fetch(`${API_BASE}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
          fetch(`${API_BASE}/api/admin/metrics`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        ]);

        const uj = await ur.json().catch(()=>({}));
        const mj = await mr.json().catch(()=>({}));

        if (!ur.ok) throw new Error(uj?.detail || `Users HTTP ${ur.status}`);
        if (!mr.ok) throw new Error(mj?.detail || `Metrics HTTP ${mr.status}`);

        setItems(uj.items || []);
        setMetrics(mj);
      } catch(e:any) { setErr(String(e.message||e)); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <main style={{minHeight:"100vh",background:"#0b0f1a",color:"#e5e7eb",padding:24}}>
      <h1>Admin — Users</h1>

      {metrics && (
        <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12, margin:"10px 0 16px"}}>
          <Tile title="Active Pro" value={metrics.active_total.toString()} />
          <Tile title="MRR" value={Object.entries(metrics.mrr).map(([k,v]) => `${k} ${v}`).join("  ·  ")} />
          <Tile title="Cancels (7d)" value={metrics.cancelled_7d.toString()} />
        </div>
      )}

      {err && <div style={{margin:"10px 0", padding:10, border:"1px solid #5a3535", background:"#331b1b"}}>{err}</div>}

      <div style={{overflow:"auto", border:"1px solid #243044", borderRadius:10}}>
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#0e1320"}}>
              <th style={th}>Email</th>
              <th style={th}>Paid</th>
              <th style={th}>Plan status</th>
              <th style={th}>Subscription ID</th>
              <th style={th}>Admin</th>
              <th style={th}>Active</th>
              <th style={th}>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td style={td} colSpan={7}>Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td style={td} colSpan={7}>No users found</td></tr>
            ) : items.map(u => (
              <tr key={u.id} style={{borderTop:"1px solid #243044"}}>
                <td style={td}>{u.email}</td>
                <td style={td}>{u.is_paid ? "yes" : "no"}</td>
                <td style={td}>{u.plan_status || "—"}</td>
                <td style={{...td, fontFamily:"monospace"}}>{u.subscription_id || "—"}</td>
                <td style={td}>{u.is_admin ? "yes" : "no"}</td>
                <td style={td}>{u.is_active ? "yes" : "no"}</td>
                <td style={td}>{u.created_at ? new Date(u.created_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Tile({title, value}:{title:string; value:string}) {
  return (
    <div style={{border:"1px solid #243044", background:"#0e1320", borderRadius:10, padding:12}}>
      <div style={{opacity:.7, fontSize:12}}>{title}</div>
      <div style={{fontSize:22, fontWeight:800, marginTop:4}}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign:"left", padding:"10px 12px", fontWeight:700, fontSize:13, borderBottom:"1px solid #243044" };
const td: React.CSSProperties = { padding:"10px 12px", fontSize:13 };
