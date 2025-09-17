"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getApiBase,
  saveToken,
  getToken,
  clearToken,
  fetchWithAuth,
  routeForTier,
  type Tier,
} from "../../lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Prevent double redirects
  const redirectOnceRef = useRef(false);

  // If already logged in, bounce to the right place (once)
  useEffect(() => {
    if (redirectOnceRef.current) return;
    const token = getToken();
    if (!token) return;

    (async () => {
      try {
        const r = await fetchWithAuth("/api/profile");
        if (r.ok) {
          const j: any = await r.json();
          redirectOnceRef.current = true;
          router.replace(routeForTier((j?.tier as Tier) || "demo"));
        } else {
          clearToken();
        }
      } catch {
        // ignore; stay on page
      }
    })();
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await fetch(`${getApiBase()}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Signup failed");

      const data: any = await res.json();
      const token: string | undefined = data?.access_token;

      if (token) {
        saveToken(token);
        const p = await fetchWithAuth("/api/profile");
        if (p.ok) {
          const j: any = await p.json();
          router.push(routeForTier((j?.tier as Tier) || "demo"));
        } else {
          router.push("/dashboard");
        }
      } else {
        router.push("/login");
      }
    } catch (err: any) {
      setError(err?.message ?? "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-black text-white flex items-start justify-center pt-20 px-4">
      <div className="max-w-md w-full rounded-2xl bg-neutral-900/80 p-6 shadow-xl">
        <h1 className="text-2xl font-semibold mb-4">Create your account</h1>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block mb-1 text-sm text-neutral-300">Email</label>
            <input
              type="email"
              className="w-full rounded px-3 py-2 bg-neutral-800 text-white outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
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
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition"
          >
            {busy ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="mt-4 text-sm text-neutral-400">
          Already have an account?{" "}
          <a className="underline text-blue-400 hover:text-blue-300" href="/login">
            Log in
          </a>
        </p>
      </div>
    </main>
  );
}
