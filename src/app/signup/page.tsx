"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!; // e.g. https://caio-backend.onrender.com

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      // OAuth2 form-encoded: username/password
      const body = new URLSearchParams();
      body.set("username", email.trim());
      body.set("password", pw);

      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || res.statusText);
      const j = JSON.parse(text);

      const token = j.access_token as string;
      if (!token) throw new Error("No access_token in response");

      // save both cookie and localStorage so getAuthToken() finds it
      document.cookie = `token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
      try { localStorage.setItem("token", token); } catch {}

      router.push("/dashboard");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <form onSubmit={onSubmit} className="bg-white/10 p-6 rounded-xl w-full max-w-sm space-y-4">
        <h1 className="text-2xl">Log in to CAIO</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className="w-full p-2 rounded text-black"
          required
        />
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          className="w-full p-2 rounded text-black"
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full p-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {err && <p className="text-red-300 text-sm">{err}</p>}
        <p className="text-xs opacity-70">API: {API_BASE}</p>
      </form>
    </main>
  );
}
