"use client";

import { useState } from "react";

const MARKETING_HOME =
  (process.env.NEXT_PUBLIC_MARKETING_HOME && process.env.NEXT_PUBLIC_MARKETING_HOME.trim()) ||
  "https://caioai.netlify.app";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    try {
      // clear client tokens
      try { localStorage.removeItem("access_token"); localStorage.removeItem("token"); } catch {}
      document.cookie = "token=; path=/; max-age=0; SameSite=Lax";

      // best-effort server logout (don’t block on this)
      fetch(`${process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/,"") || ""}/api/logout`, {
        method: "POST",
        credentials: "include",
      }).catch(() => { /* ignore */ });
    } finally {
      // go to marketing site (Netlify), like before
      window.location.assign(MARKETING_HOME);
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
