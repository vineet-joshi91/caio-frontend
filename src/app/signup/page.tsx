"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ---------- self-contained auth utils ---------- */
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

type Tier = "admin" | "premium" | "pro_plus" | "pro" | "demo";

function saveToken(tok: string) {
  try {
    localStorage.setItem("access_token", tok);
    localStorage.setItem("token", tok);
    document.cookie = `token=${encodeURIComponent(tok)}; path=/; SameSite=Lax`;
  } catch {}
}
function getToken(): string {
  try {
    return (
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      ""
    );
  } catch {
    return "";
  }
}
function clearToken() {
  try {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
    document.cookie = "token=; Max-Age=0; path=/";
  } catch {}
}
async function fetchProfileByToken(tok: string) {
  const r = await fetch(`${API_BASE}/api/profile`, {
    headers: { Authorization: `Bearer ${tok}` },
  });
  return r;
}
function routeForTier(t: Tier): string {
  if (t === "admin" || t === "premium" || t === "pro_plus") return "/premium/chat";
  return "/dashboard";
}

/* ------------------ page ------------------ */
export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectOnceRef = useRef(false);

  // If already logged in, bounce once
  useEffect(() => {
    const tok = getToken();
    if (!tok || redirectOnceRef.current) return;
    (async () => {
      try {
        const r = await fetchProfileByToken(tok);
        if (r.ok) {
          const j = await r.json();
          redirectOnceRef.current = true;
          router.replace(routeForTier((j?.tier as Tier) || "demo"));
        } else {
          clearToken();
        }
      } catch {
        /* ignore */
      }
    })();
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const resp = await fetch(`${API_BASE}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        //credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const raw = await resp.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch {}

      if (!resp.ok) {
        clearToken();
        throw new Error(
          data?.detail || data?.message || raw || "Signup failed. Please try again."
        );
      }

      const tok: string | undefined = data?.access_token;
      if (tok) {
        saveToken(tok);
        const p = await fetchProfileByToken(tok);
        if (p.ok) {
          const j = await p.json();
          router.replace(routeForTier((j?.tier as Tier) || "demo"));
        } else {
          router.replace("/dashboard");
        }
      } else {
        // Some backends may not auto-login after signup; fall back to login
        router.replace("/login");
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
          <Link href="/login" className="underline text-blue-400 hover:text-blue-300">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
