"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuthToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;            // e.g., https://caio-backend.onrender.com
const LOGIN_URL = process.env.NEXT_PUBLIC_LOGIN_URL || "/signup";

type Me = {
  email: string;
  is_admin: boolean;
  is_paid: boolean;
  created_at?: string;
};

function withTimeout<T>(p: Promise<T>, ms = 12000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const token = useMemo(() => getAuthToken(), []);

  useEffect(() => {
    (async () => {
      if (!token) { setBusy(false); return; } // not logged in
      try {
        setBusy(true); setError(null);
        const res = await withTimeout(
          fetch(`${API_BASE}/api/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          12000
        );
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Profile ${res.status}: ${txt || res.statusText}`);
        }
        const j = await res.json();
        setMe({
          email: j.email,
          is_admin: !!j.is_admin,
          is_paid: !!j.is_paid,
          created_at: j.created_at,
        });
      } catch (e: any) {
        setError(e?.message || "Failed to load profile");
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    try {
      document.cookie = "token=; path=/; max-age=0; SameSite=Lax";
      try { localStorage.removeItem("token"); } catch {}
    } catch {}
    // same-tab redirect to your marketing/login site
    window.location.assign("https://caioai.netlify.app");
  }

  function refreshStatus() {
    router.refresh(); // soft refresh
  }

  if (busy) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="opacity-80">Loading…</div>
      </main>
    );
  }

  // Not logged in
  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="bg-white/10 p-6 rounded-xl text-center">
          <h1 className="text-2xl mb-2">Welcome to CAIO</h1>
          <p className="opacity-80 mb-4">You’re not logged in.</p>
          {LOGIN_URL.startsWith("http") ? (
            <a href={LOGIN_URL} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500">Go to Login</a>
          ) : (
            <Link href={LOGIN_URL} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500">Go to Login</Link>
          )}
        </div>
      </main>
    );
  }

  // Error state
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="max-w-xl w-full bg-white/10 p-6 rounded-xl">
          <h1 className="text-xl mb-2">Dashboard</h1>
          <p className="text-red-300 mb-3">Error: {error}</p>
          <ul className="text-sm opacity-80 list-disc pl-5 space-y-1">
            <li>API base: <code>{API_BASE}</code></li>
            <li>Try logging out and in again to mint a fresh token.</li>
          </ul>
          <div className="mt-3 flex gap-2">
            <button onClick={refreshStatus} className="px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-sm">Retry</button>
            <button onClick={logout} className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-sm">Logout</button>
          </div>
        </div>
      </main>
    );
  }

  // Happy path
  return (
    <main className="min-h-screen p-6 bg-black text-white">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="bg-white/10 p-6 rounded-xl">
          <h1 className="text-2xl mb-1">Welcome to CAIO</h1>
          <p className="opacity-80">
            Logged in as <b>{me?.email}</b> • {me?.is_admin ? "Admin" : "User"} • {me?.is_paid ? "Pro" : "Demo"}
          </p>
          <div className="mt-3 flex gap-2">
            {!me?.is_paid && (
              <Link href="/payments" className="underline text-blue-300">
                Upgrade to Pro
              </Link>
            )}
            <button onClick={refreshStatus} className="px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-sm">
              Refresh status
            </button>
            <button onClick={logout} className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-sm">
              Logout
            </button>
          </div>
        </header>
      </div>
    </main>
  );
}
