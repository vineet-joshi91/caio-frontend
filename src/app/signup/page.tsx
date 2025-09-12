"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

/* Small helpers */
function withTimeout<T>(p: Promise<T>, ms = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout/${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

async function warmBackend(): Promise<void> {
  try {
    await withTimeout(fetch(`${API_BASE}/api/ready`, { cache: "no-store" }), 6000);
  } catch {
    // ignore; we'll still try signup and handle retries
  }
}

async function postJsonWithRetry(url: string, body: any, tries = 2): Promise<Response> {
  let lastErr: any = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await withTimeout(
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        }),
        15000
      );
      return res;
    } catch (e: any) {
      lastErr = e;
      // network/cold-start: brief backoff then retry
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw lastErr || new Error("network");
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  function saveToken(t?: string) {
    try { if (t) localStorage.setItem("access_token", t); } catch {}
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setHint(null);

    if (!email.trim() || !password.trim()) {
      setErr("Please enter email and password.");
      return;
    }

    setBusy(true);
    try {
      setHint("Warming server…");
      await warmBackend();

      setHint(null); // clear if warmup succeeded
      const res = await postJsonWithRetry(`${API_BASE}/api/signup`, {
        name: name.trim(),
        organization: organization.trim() || organization.trim(), // accept either label
        email: email.trim(),
        password,
      }, 2);

      const text = await res.text();
      let j: any = {};
      try { j = text ? JSON.parse(text) : {}; } catch {}

      if (!res.ok) {
        const msg = j?.detail || j?.message || text || `Signup failed (HTTP ${res.status}).`;
        setErr(String(msg));
        return;
      }

      saveToken(j?.access_token);
      router.replace("/dashboard");
    } catch (e: any) {
      // This is the previous “Failed to fetch” case — show a clearer message.
      setErr("Server is waking up or unreachable. Please try again in a few seconds.");
      setHint("Tip: If it persists, check NEXT_PUBLIC_API_BASE and CORS allowlist.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
        <h1 className="text-xl font-semibold">Create your account</h1>

        <label className="mt-4 block text-sm opacity-85">Name</label>
        <input
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 p-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
        />

        <label className="mt-4 block text-sm opacity-85">Organisation</label>
        <input
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 p-2"
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          placeholder="Acme Corp"
        />

        <label className="mt-4 block text-sm opacity-85">Work email</label>
        <input
          type="email"
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 p-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />

        <label className="mt-4 block text-sm opacity-85">Password</label>
        <input
          type="password"
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 p-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        {err && (
          <div className="mt-3 rounded-md border border-red-700 bg-red-900/30 p-2 text-sm text-red-200">
            {err}
          </div>
        )}
        {hint && (
          <div className="mt-2 text-xs opacity-70">{hint}</div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-emerald-600 py-2 font-medium hover:bg-emerald-500 disabled:opacity-60"
        >
          {busy ? "Signing up…" : "Sign up"}
        </button>

        <div className="mt-3 text-sm opacity-80">
          Already have an account?{" "}
          <Link href="/login" className="underline text-blue-300 hover:text-blue-200">
            Log in
          </Link>
        </div>
      </form>
    </main>
  );
}
