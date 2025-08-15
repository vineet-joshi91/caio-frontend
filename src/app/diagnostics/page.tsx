"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "(missing)";

function timeout<T>(p: Promise<T>, ms = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); })
     .catch(e => { clearTimeout(t); reject(e); });
  });
}

export default function Diagnostics() {
  const [token, setToken] = useState<string>("(none)");
  const [health, setHealth] = useState<string>("pending…");
  const [profile, setProfile] = useState<string>("pending…");

  useEffect(() => {
    // read cookie + localStorage
    try {
      const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
      setToken(m ? decodeURIComponent(m[1]) : (localStorage.getItem("token") || "(none)"));
    } catch {
      setToken("(error reading token)");
    }

    // health
    timeout(fetch(`${API_BASE}/api/health`), 8000)
      .then(async r => setHealth(`${r.status} ${r.statusText} :: ${await r.text()}`))
      .catch(e => setHealth(String(e)));

    // profile (if token present)
    const t = (() => {
      const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : localStorage.getItem("token");
    })();
    if (t) {
      timeout(fetch(`${API_BASE}/api/profile`, {
        headers: { Authorization: `Bearer ${t}` }
      }), 8000)
        .then(async r => setProfile(`${r.status} ${r.statusText} :: ${await r.text()}`))
        .catch(e => setProfile(String(e)));
    } else {
      setProfile("no token");
    }
  }, []);

  return (
    <main style={{padding:24, fontFamily:"system-ui", color:"#fff", background:"#000", minHeight:"100vh"}}>
      <h1 style={{fontSize:24, marginBottom:10}}>Diagnostics</h1>
      <div style={{opacity:.85}}>
        <p><b>NEXT_PUBLIC_API_BASE:</b> {API_BASE}</p>
        <p><b>Token present:</b> {token && token !== "(none)" ? "yes" : "no"}</p>
        <p><b>/api/health:</b> {health}</p>
        <p><b>/api/profile:</b> {profile}</p>
      </div>
      <p style={{marginTop:16, opacity:.7, fontSize:12}}>
        If <code>/api/profile</code> is 401 → login again. If it’s a CORS error or a 403/404/500, we’ll fix config or routes.
      </p>
    </main>
  );
}
