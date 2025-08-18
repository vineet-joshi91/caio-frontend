"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuthToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!; // e.g., https://caio-backend.onrender.com

type Me = {
  email: string;
  is_admin: boolean;
  is_paid: boolean;
  created_at?: string;
};

function withTimeout<T>(p: Promise<T>, ms = 12000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); },
           e => { clearTimeout(t); reject(e); });
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
      if (!token) { router.push("/"); return; }
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
    router.push("/"); // back to login
  }

  function refreshStatus() {
    router.refresh(); // soft refresh; fallback: window.location.reload()
  }

  if (busy) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="opacity-80">Loading…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="max-w-xl w-full bg-white/10 p-6 rounded-xl">
          <h1 className="text-xl mb-2">Dashboard</h1>
          <p className="text-red-300 mb-3">Error: {error}</p>
          <ul className="text-sm opacity-80 list-disc pl-5 space-y-1">
            <li>Check <code>NEXT_PUBLIC_API_BASE</code> is <code>{API_BASE}</code>.</li>
            <li>Backend must allow this origin in <code>ALLOWED_ORIGINS</code>.</li>
            <li>Log in again if your token expired/rotated.</li>
          </ul>
          <div className="mt-3">
            <button onClick={logout} className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-sm">
              Logout
            </button>
          </div>
        </div>
      </main>
    );
  }

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

        {/* Optional: keep your quick analyze block here if you want */}
      </div>
    </main>
  );
}
