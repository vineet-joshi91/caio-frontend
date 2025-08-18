"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuthToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;
const NETLIFY_HOME = "https://caioai.netlify.app";

type Me = { email: string; is_admin: boolean; is_paid: boolean; created_at?: string; };

function withTimeout<T>(p: Promise<T>, ms = 12000) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v as T); }, e => { clearTimeout(t); reject(e); });
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const token = useMemo(() => getAuthToken(), []);
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) { setBusy(false); return; }
      try {
        const res = await withTimeout(fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }), 12000);
        if (!res.ok) throw new Error(await res.text());
        const j = await res.json();
        setMe({ email: j.email, is_admin: !!j.is_admin, is_paid: !!j.is_paid, created_at: j.created_at });
      } catch (e: any) {
        setErr(e?.message || "Failed to load profile");
      } finally {
        setBusy(false);
      }
    })();
  }, [token]);

  function logout() {
    try {
      document.cookie = "token=; path=/; max-age=0; SameSite=Lax";
      try { localStorage.removeItem("token"); } catch {}
    } catch {}
    window.location.assign(NETLIFY_HOME); // same-tab
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="bg-white/10 p-6 rounded-xl text-center">
          <h1 className="text-2xl mb-2">Welcome to CAIO</h1>
          <p className="opacity-80 mb-4">You’re not logged in.</p>
          <Link href="/signup" className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500">Go to Login</Link>
        </div>
      </main>
    );
  }

  if (busy) {
    return <main className="min-h-screen flex items-center justify-center bg-black text-white">Loading…</main>;
  }

  if (err) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="bg-white/10 p-6 rounded-xl">
          <h1 className="text-xl mb-2">Dashboard</h1>
          <p className="text-red-300">Error: {err}</p>
          <div className="mt-3 flex gap-2">
            <Link href="/signup" className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm">Re-login</Link>
            <button onClick={logout} className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-sm">Logout</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 bg-black text-white">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="bg-white/10 p-6 rounded-xl">
          <h1 className="text-2xl mb-1">Dashboard</h1>
          <p className="opacity-80">
            Logged in as <b>{me?.email}</b> • {me?.is_admin ? "Admin" : "User"} • {me?.is_paid ? "Pro" : "Demo"}
          </p>
          <div className="mt-3 flex gap-2">
            {!me?.is_paid && <Link href="/payments" className="underline text-blue-300">Upgrade to Pro</Link>}
            <button onClick={logout} className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-sm">Logout</button>
          </div>
        </header>
      </div>
    </main>
  );
}
