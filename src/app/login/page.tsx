'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

function normalizeError(input: unknown): string {
  if (!input) return 'Something went wrong';
  if (typeof input === 'string') return input;

  try {
    // If it's a Response body we already read as text, try parse
    const j = typeof input === 'object' ? input as any : JSON.parse(String(input));
    if (j?.detail) return typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
    if (j?.message) return String(j.message);
    return JSON.stringify(j);
  } catch {
    return String(input);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPw, setShowPw] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>('');

  const redirectTo = params.get('redirect') || '/premium/chat';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!API_BASE) throw new Error('API base is not configured');

      // OAuth2PasswordRequestForm expects x-www-form-urlencoded with "username" & "password"
      const body = new URLSearchParams();
      body.set('username', email.trim());
      body.set('password', password);

      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        // keep default 'cors' mode; backend must allow our origin
      });

      const raw = await res.text();
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { /* leave as null/string */ }

      if (!res.ok) {
        // Prefer server's 'detail' when available
        const msg =
          (data && typeof data === 'object' && data.detail) ||
          (raw && typeof raw === 'string' && raw) ||
          `Login failed (${res.status})`;
        throw new Error(normalizeError(msg));
      }

      const token = data?.access_token;
      if (!token || typeof token !== 'string') {
        throw new Error('No token returned from server');
      }

      // Persist token for later API calls
      localStorage.setItem('access_token', token);

      // Optional: keep token_type if you ever need it
      if (data?.token_type) localStorage.setItem('token_type', String(data.token_type));

      // Navigate to chat (or a redirect target)
      router.replace(redirectTo);
    } catch (err: any) {
      setError(normalizeError(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full grid place-items-center bg-black text-white px-4">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900/70 shadow-xl p-6 md:p-8 border border-zinc-800">
        <h1 className="text-2xl font-semibold mb-6">Log in to CAIO</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm text-zinc-300">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@company.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm text-zinc-300">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 pr-12 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-200"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm leading-relaxed break-words">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-4 py-2 font-semibold transition"
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-400">
          New here?{' '}
          <a href="/signup" className="text-blue-400 hover:underline">
            Create an account
          </a>
        </p>
      </div>
    </div>
  );
}
