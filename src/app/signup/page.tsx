'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_BASE ?? '';

type FastAPIError =
  | { detail?: string }
  | { detail?: Array<{ msg?: string; loc?: (string | number)[]; type?: string }> };

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function extractError(e: any): string {
    try {
      if (!e) return 'Something went wrong';
      if (typeof e === 'string') return e;
      if (e.detail) {
        if (typeof e.detail === 'string') return e.detail;
        if (Array.isArray(e.detail)) {
          return (
            e.detail
              .map((d: any) => {
                const where = Array.isArray(d?.loc) ? d.loc.join('.') : '';
                return d?.msg ? `${where}: ${d.msg}` : where;
              })
              .filter(Boolean)
              .join('; ') || 'Validation error'
          );
        }
      }
      return 'Unexpected error';
    } catch {
      return 'Unexpected error';
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      // Backend expects { username, password, ... }
      const res = await fetch(`${API}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: email.trim(),   // <-- map email to username
          password: password,       // <-- backend requires this field
          name: name.trim(),        // optional; backend may ignore/save
          org: org.trim(),          // optional
          source: 'signup',
        }),
      });

      if (!res.ok) {
        let msg = `Sign up failed (${res.status})`;
        try {
          const data: FastAPIError = await res.json();
          msg = extractError(data);
        } catch {}
        throw new Error(msg);
      }

      const data = await res.json();
      const token = data.access_token || data.token || '';
      if (!token) throw new Error('No token returned from server');

      localStorage.setItem('access_token', token);
      localStorage.setItem('token', token); // keep legacy key if other pages read it
      router.push('/dashboard');
    } catch (e: any) {
      setErr(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold">Create your account</h1>

        <div className="space-y-1">
          <label className="text-sm text-zinc-400">Name</label>
          <input
            className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 outline-none focus:border-zinc-500"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Jane Doe"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-zinc-400">Organisation</label>
          <input
            className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 outline-none focus:border-zinc-500"
            value={org}
            onChange={e => setOrg(e.target.value)}
            placeholder="Acme Inc."
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-zinc-400">Work email</label>
          <input
            type="email"
            className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 outline-none focus:border-zinc-500"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-zinc-400">Password</label>
          <input
            type="password"
            className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 outline-none focus:border-zinc-500"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
          />
        </div>

        {err && (
          <div className="text-sm text-red-300 rounded-lg border border-red-800 bg-red-900/30 px-3 py-2 whitespace-pre-wrap">
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg py-2 font-medium bg-gradient-to-r from-sky-500 to-emerald-500 text-white disabled:opacity-60"
        >
          {loading ? 'Creating...' : 'Sign up'}
        </button>

        <p className="text-xs text-zinc-500">
          Already have an account?{' '}
          <a className="underline" href="/login">Log in</a>
        </p>
      </form>
    </div>
  );
}
