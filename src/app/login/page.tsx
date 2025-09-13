"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getApiBase, saveToken, getToken, clearToken, fetchWithAuth, routeForTier, type Tier } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) return;
    (async () => {
      try {
        const r = await fetchWithAuth("/api/profile");
        if (r.ok) router.replace("/dashboard");
        else clearToken();
      } catch {
        // ignore
      }
    })();
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`${getApiBase()}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Login failed");

      const data: any = await res.json();
      const token: string | undefined = data?.access_token;
      if (!token) throw new Error("No access token returned by server.");
      saveToken(token);

      const p = await fetchWithAuth("/api/profile");
      if (p.ok) {
        const j: any = await p.json();
        router.push(routeForTier((j?.tier as Tier) || "demo"));
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-black text-white flex items-start justify-center pt-20 px-4">
      <div className="max-w-md w-full rounded-2xl bg-neutral-900/80 p-6 shadow-xl">
        <h1 className="text-2xl font-semibold mb-4">Log in to CAIO</h1>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm text-neutral-300">Email</label>
            <input
              type="email"
              className="w-full rounded px-3 py-2 bg-neutral-800 text-white outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm text-neutral-300">Password</label>
            <input
              type="password"
              className="w-full rounded px-3 py-2 bg-neutral-800 text-white outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition"
          >
            {busy ? "Signing in…" : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-sm text-neutral-400">
          New here?{" "}
          <Link href="/signup" className="underline text-blue-400 hover:text-blue-300">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
