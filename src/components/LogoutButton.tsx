"use client";

import { useState } from "react";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim().replace(/\/+$/,"")) ||
  "https://caio-orchestrator.onrender.com";

// Where to send users AFTER logout.
// Set this in Vercel to your marketing site, e.g. https://caioinsights.com
const MARKETING_HOME =
  (process.env.NEXT_PUBLIC_MARKETING_HOME && process.env.NEXT_PUBLIC_MARKETING_HOME.trim()) ||
  "/login"; // fallback to login if you don't want to leave the app

async function serverLogout() {
  try {
    const r = await fetch("/api/logout", { method: "POST", credentials: "include" });
    if (r.ok) return;
  } catch {}
  try {
    await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "include" });
  } catch {}
}

function clearClientTokens() {
  try {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
  } catch {}
  document.cookie = "token=; Path=/; Max-Age=0; SameSite=Lax";
}

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      clearClientTokens();
      await serverLogout();
    } finally {
      window.location.assign(MARKETING_HOME); // ✅ send to website (or /login fallback)
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={busy}
      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm shadow disabled:opacity-60"
    >
      {busy ? "Logging out…" : "Logout"}
    </button>
  );
}
