'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setAuthToken, getStoredToken, Profile, LoginResponse } from '@/lib/api';

const ADMIN_EMAIL = 'vineetpjoshi.71@gmail.com';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // If there’s already a token, try to fast-redirect based on profile
  useEffect(() => {
    const existing = getStoredToken();
    if (!existing) return;
    setAuthToken(existing);
    (async () => {
      try {
        const { data } = await api.get<Profile>('/api/profile');
        if (data.is_admin || data.email.toLowerCase() === ADMIN_EMAIL) {
          router.replace('/admin');
        } else {
          router.replace('/dashboard');
        }
      } catch {
        // silently ignore and let user log in again
      }
    })();
  }, [router]);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      // FastAPI OAuth2PasswordRequestForm expects form fields "username" and "password"
      const form = new URLSearchParams();
      form.set('username', email.trim());
      form.set('password', password);

      const { data } = await api.post<LoginResponse>('/api/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      setAuthToken(data.access_token);

      // Load profile to decide where to go
      const profile = await api.get<Profile>('/api/profile').then(r => r.data);

      if (profile.is_admin || profile.email.toLowerCase() === ADMIN_EMAIL) {
        router.replace('/admin');
      } else {
        router.replace('/dashboard');
      }
    } catch (err) {
      setMessage('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">CAIO</h1>
        <p className="text-slate-600 mb-6">Your AI-Powered Chief Intelligence Officer</p>

        <form onSubmit={handleLogin} className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm text-slate-600">Email</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-slate-600">Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-semibold px-4 py-2 disabled:opacity-60"
          >
            {loading ? 'Logging in…' : 'Login'}
          </button>

          {message && <p className="text-red-600 text-sm">{message}</p>}
        </form>

        <div className="mt-4 text-sm">
          <span className="text-slate-600">Don&apos;t have an account? </span>
          <Link href="/signup" className="text-blue-800 font-semibold hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}
