// src/app/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAuthToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!; // no trailing slash

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: email, password }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Login failed (${res.status}): ${txt}`);
      }
      const data = await res.json();
      if (!data?.access_token) throw new Error("No access_token in response");
      setAuthToken(data.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white/10 p-6 rounded-xl backdrop-blur">
        <h1 className="text-2xl mb-4">Log in to CAIO</h1>
        <label className="block mb-2 text-sm">Email</label>
        <input className="w-full mb-4 p-2 rounded text-black" type="email" required
               value={email} onChange={(e)=>setEmail(e.target.value)} />
        <label className="block mb-2 text-sm">Password</label>
        <input className="w-full mb-6 p-2 rounded text-black" type="password" required
               value={password} onChange={(e)=>setPassword(e.target.value)} />
        {error && <p className="text-red-300 text-sm mb-3">{error}</p>}
        <button disabled={busy} className="w-full py-2 rounded bg-blue-600 disabled:opacity-60">
          {busy ? "Logging in..." : "Log in"}
        </button>
        <p className="text-xs mt-3 opacity-70">API: {API_BASE}</p>
      </form>
    </main>
  );
}
