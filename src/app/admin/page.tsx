"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function AdminUsers() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [me, setMe] = useState<{ email: string; is_admin: boolean } | null>(null);

  function getToken(): string | null {
    try {
      const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : localStorage.getItem("token");
    } catch {
      return null;
    }
  }
  function clearToken() {
    document.cookie = "token=; Max-Age=0; Path=/";
    localStorage.removeItem("token");
  }

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/login"); return; }

    (async () => {
      try {
        const meRes = await fetch(`${API_BASE}/api/profile`, { headers: { Authorization: `Bearer ${token}` }, cache:"no-store" });
        const meJson = await meRes.json().catch(() => ({}));
        if (!meRes.ok) throw new Error(meJson?.detail || `Profile ${meRes.status}`);
        setMe({ email: meJson.email, is_admin: !!meJson.is_admin });
        if (!meJson.is_admin) throw new Error("Admins only");

        const r = await fetch(`${API_BASE}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` }, cache:"no-store" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.detail || `HTTP ${r.status}`);
        setData(j);
      } catch (e: any) {
        setErr(String(e.message || e));
      }
    })();
  }, [router]);

  function logout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <main style={{padding:24, fontFamily:"system-ui", color:"#e5e7eb", background:"#0b0f1a", minHeight:"100vh"}}>
      <h1 style={{fontSize:22, margin:"0 0 10px"}}>Admin · Users</h1>
      <div style={{opacity:.85, marginBottom:8}}>
        <div><b>Logged in as:</b> {me?.email || "—"}</div>
        <div><b>Admin:</b> {me?.is_admin ? "yes" : "no"}</div>
      </div>
      {err ? <div style={errBox}>{err}</div> : null}
      {!data ? <div>Loading…</div> : (
        <>
          <div style={{opacity:.8, marginBottom:8}}>Total: {data.count}</div>
          <div style={{overflowX:"auto"}}>
            <table style={{borderCollapse:"collapse", minWidth:720}}>
              <thead>
                <tr>
                  {["Email","Name","Organisation","Admin","Paid","Created"].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.users.map((u:any) => (
                  <tr key={u.email}>
                    <td style={td}>{u.email}</td>
                    <td style={td}>{u.name || "-"}</td>
                    <td style={td}>{u.organisation || u.company || "-"}</td>
                    <td style={td}>{u.is_admin ? "yes" : "no"}</td>
                    <td style={td}>{u.is_paid ? "yes" : "no"}</td>
                    <td style={td}>{u.created_at || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div style={{marginTop:12}}>
        <button onClick={logout} style={btn}>Log out</button>
      </div>
    </main>
  );
}

const th: React.CSSProperties = { textAlign:"left", padding:"8px 10px", borderBottom:"1px solid #243044", background:"#0f172a" };
const td: React.CSSProperties = { padding:"8px 10px", borderBottom:"1px solid #1f2a44" };
const errBox: React.CSSProperties = { margin:"8px 0", padding:"8px 10px", borderRadius:8, background:"#3a1f1f", border:"1px solid #5a3535", color:"#fecaca", fontSize:13 };
const btn: React.CSSProperties = { padding:"8px 12px", borderRadius:8, border:"1px solid #2b3650", background:"#0f172a", color:"#93c5fd", cursor:"pointer" };
