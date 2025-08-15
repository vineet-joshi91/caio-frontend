// src/app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuthToken, getAuthToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

type Stats = { users: number; paid_users: number; usage_logs: number; admin_email: string };

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [me, setMe] = useState<{ email: string; is_admin: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) { router.push("/"); return; }

    (async () => {
      try {
        const meRes = await fetch(`${API_BASE}/api/profile`, { headers: { Authorization: `Bearer ${token}` }});
        if (!meRes.ok) throw new Error(`Profile ${meRes.status}`);
        const meJson = await meRes.json();
        setMe({ email: meJson.email, is_admin: meJson.is_admin });

        const sRes = await fetch(`${API_BASE}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` }});
        if (!sRes.ok) throw new Error(`Stats ${sRes.status}`);
        setStats(await sRes.json());
      } catch (e: any) {
        setErr(e.message || "Failed to load admin data");
      }
    })();
  }, [router]);

  function logout() {
    clearAuthToken();
    router.push("/");
  }

  return (
    <main className="min-h-screen p-6 flex items-start justify-center bg-black text-white">
      <div className="w-full max-w-3xl bg-white/10 p-6 rounded-xl">
        <h2 className="text-xl mb-2">Admin dashboard</h2>
        <p className="opacity-80">
          <b>Logged in as:</b> {me?.email || "unknown"}<br/>
          <b>Admin:</b> {me?.is_admin ? "true" : "false"}
        </p>

        {err && <p className="text-red-300 mt-3">{err}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="bg-white/10 p-4 rounded-xl">
            <div className="opacity-70 text-sm">Users</div>
            <div className="text-3xl">{stats?.users ?? 0}</div>
          </div>
          <div className="bg-white/10 p-4 rounded-xl">
            <div className="opacity-70 text-sm">Paid users</div>
            <div className="text-3xl">{stats?.paid_users ?? 0}</div>
          </div>
          <div className="bg-white/10 p-4 rounded-xl">
            <div className="opacity-70 text-sm">Usage logs</div>
            <div className="text-3xl">{stats?.usage_logs ?? 0}</div>
          </div>
          <div className="bg-white/10 p-4 rounded-xl">
            <div className="opacity-70 text-sm">Admin email (server)</div>
            <div className="text-lg break-all">{stats?.admin_email || "-"}</div>
          </div>
        </div>

        <button onClick={logout} className="px-4 py-2 rounded bg-slate-900 hover:bg-slate-800">
          Log out
        </button>
      </div>
    </main>
  );
}
