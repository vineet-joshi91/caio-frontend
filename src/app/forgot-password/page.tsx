"use client";

import { useState } from "react";
import Link from "next/link";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.trim().replace(/\/+$/, "")) ||
  "https://caioinsights.com";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      // Placeholder endpoint. If you don’t have it yet, we still show a safe message.
      const r = await fetch(`${API_BASE}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      // Always show a non-leaky success message (don’t reveal whether email exists)
      setMsg(
        "If this email exists in our system, you’ll receive password reset instructions shortly."
      );

      // Optional: only show errors if the server is truly down
      if (!r.ok) {
        // swallow most errors to avoid leaking info
      }
    } catch {
      setMsg(
        "If this email exists in our system, you’ll receive password reset instructions shortly."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0b0f1a] text-gray-200 p-6">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Reset password</h1>

        <p className="text-sm opacity-80">
          Enter your email and we’ll send reset instructions.
        </p>

        {err && (
          <div className="rounded-lg border border-red-700 bg-red-900/30 px-3 py-2 text-sm">
            {err}
          </div>
        )}

        {msg && (
          <div className="rounded-lg border border-green-700 bg-green-900/20 px-3 py-2 text-sm">
            {msg}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm opacity-80">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[#243044] bg-[#0e1320] px-3 py-2 outline-none"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-3 py-2 font-medium"
          >
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="text-sm opacity-80">
          <Link href="/login" className="underline text-blue-400 hover:text-blue-300">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
