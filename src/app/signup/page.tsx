"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;
const ALLOWED = (process.env.NEXT_PUBLIC_ALLOWED_EMAILS || "").split(",").map(s => s.trim()).filter(Boolean);

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function isAllowed(email: string) {
    if (ALLOWED.length === 0) return true; // if not configured, allow all (for later)
    return ALLOWED.includes(email.trim().toLowerCase());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const em = email.trim().toLowerCase();
    if (!isAllowed(em)) {
      setErr("You're on the waitlist. Please use your approved email to sign in.");
      return;
    }

    setBusy(true);
    try {
      const form = new URLSearchParams();
      form.set("username", em);
      form.set("password", pw);

      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });

      if (!res.ok) {
        setErr("Incorrect email or password.");
        return;
      }

      const j = await res.json();
      const token = j?.access_token as string | undefined;
      if (!token) {
        setErr("Unable to sign in. Please try again.");
        return;
      }

      // store for getAuthToken()
      document.cookie = `token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
      try { localStorage.setItem("token", token); } catch {}

      router.push("/dashboard");
    } catch {
      setErr("Network issue. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-zinc-900/70 rounded-2xl border border-zinc-800 p-6 shadow-xl space-y-4">
        <h1 className="text-2xl font-semibold">Log in to CAIO</h1>

        <div className="space-y-2">
          <label className="text-sm opacity-85">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="w-full p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            placeholder="you@domain.com"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm opacity-85">Password</label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 shadow"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        {err && <p className="text-red-300 text-sm">{err}</p>}
      </form>
    </main>
  );
}
