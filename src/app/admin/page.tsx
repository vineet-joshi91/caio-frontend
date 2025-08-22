"use client";
import { useEffect, useState } from "react";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

type U = {
  id: number; email: string; is_admin: boolean; is_active: boolean;
  is_paid: boolean; subscription_id?: string | null; plan_status?: string | null; created_at?: string | null;
};

export default function AdminUsers() {
  const [items, setItems] = useState<U[]>([]);
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
        const r = await fetch(`${API_BASE}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const j = await r.json().catch(()=>({}));
        if (!r.ok) throw new Error(j?.detail || `HTTP ${r.status}`);
        setItems(j.items || []);
      } catch(e:any) {
        setErr(String(e.message||e));
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <main style={{minHeight:"100vh",background:"#0b0f1a",color:"#e5e7eb",padding:24}}>
      <h1>Admin — Users</h1>
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

const th: React.CSSProperties = { textAlign:"left", padding:"10px 12px", fontWeight:700, fontSize:13, borderBottom:"1px solid #243044" };
const td: React.CSSProperties = { padding:"10px 12px", fontSize:13 };
