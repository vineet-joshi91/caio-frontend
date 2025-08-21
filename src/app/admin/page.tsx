"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Same safe default as login
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

export default function AdminUsers() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [me, setMe] = useState<{ email: string; is_admin: boolean } | null>(null);
  const [debug, setDebug] = useState<any>(null);

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
      setErr(null);
      setDebug({ API_BASE });
      try {
        const meRes = await fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const meTxt = await meRes.text();
        let meJson: any = {};
        try { meJson = meTxt ? JSON.parse(meTxt) : {}; } catch {}
        if (!meRes.ok) {
          setDebug((d: any) => ({ ...d, profile: { status: `${meRes.status} ${meRes.statusText}`, body: meTxt }}));
          throw new Error(meJson?.detail || `Profile ${meRes.status}`);
        }
        setMe({ email: meJson.email, is_admin: !!meJson.is_admin });
        if (!meJson.is_admin) throw new Error("Admins only");

        const r = await fetch(`${API_BASE}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const rTxt = await r.text();
        let j: any = {};
        try { j = rTxt ? JSON.parse(rTxt) : {}; } catch {}
        setDebug((d: any) => ({ ...d, users: { status: `${r.status} ${r.statusText}`, body: rTxt }}));
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
    <main style={{ padding: 24, fontFamily: "system-ui", color: "#e5e7eb", background: "#0b0f1a", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 10px" }}>Admin · Users</h1>

      <div style={{ opacity: .85, marginBottom: 8 }}>
        <div><b>API_BASE:</b> {API_BASE}</div>
        <div><b>Logged in as:</b> {me?.email || "—"}</div>
        <div><b>Admin:</b> {me?.is_admin ? "yes" : "no"}</div>
      </div>

      {err ? <div style={errBox}>{err}</div> : null}

      {debug ? (
        <details style={{ margin: "10px 0" }}>
          <summary>Debug</summary>
          <pre style={pre}>{JSON.stringify(debug, null, 2)}</pre>
        </details>
      ) : null}

      {!data ? <div>Loading…</div> : (
        <>
          <div style={{ opacity: .8, marginBottom: 8 }}>Total: {data.count}</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  {["Email", "Name", "Organisation", "Admin", "Paid", "Created"].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.users.map((u: any) => (
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

      <div style={{ marginTop: 12 }}>
        <button onClick={logout} style={btn}>Log out</button>
      </div>
    </main>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #243044", background: "#0f172a" };
const td: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #1f2a44" };
const errBox: React.CSSProperties = { margin: "8px 0", padding: "8px 10px", borderRadius: 8, background: "#3a1f1f", border: "1px solid #5a3535", color: "#fecaca", fontSize: 13 };
const btn: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid #2b3650", background: "#0f172a", color: "#93c5fd", cursor: "pointer" };
const pre: React.CSSProperties = { whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#0d1220", border: "1px solid #23304a", borderRadius: 8, padding: 10, fontSize: 12 };
