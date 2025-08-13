// src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login, getProfile } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  // simple UI state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // On first paint: if we already have a token, go straight to the right page.
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Peek at profile to decide destination
      getProfile(token)
        .then((p) => {
          if (p.is_admin) router.replace('/admin');
          else router.replace('/dashboard');
        })
        .catch(() => {
          // token invalid → clear it, stay on login
          localStorage.removeItem('token');
        });
    } catch {
      // ignore
    }
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const { access_token } = await login(email, password);
      localStorage.setItem('token', access_token);

      const profile = await getProfile(access_token);
      // Store a tiny bit of profile for client-only checks if you want
      localStorage.setItem('email', profile.email);
      localStorage.setItem('is_admin', String(profile.is_admin));
      localStorage.setItem('is_paid', String(profile.is_paid));

      if (profile.is_admin) {
        router.replace('/admin');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: unknown) {
      setMsg('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px' }}>
      <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.1 }}>CAIO</h1>
      <p style={{ color: '#334155', marginTop: 8 }}>
        Your AI-Powered Chief Intelligence Officer
      </p>

      <form onSubmit={handleLogin} style={{ marginTop: 18 }}>
        <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
          <label style={{ fontWeight: 600 }}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            style={{
              padding: '10px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
            }}
            required
          />
          <label style={{ fontWeight: 600, marginTop: 8 }}>Password</label>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              padding: '10px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
            }}
            required
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 14,
              background: '#154272',
              color: '#fff',
              padding: '10px 16px',
              borderRadius: 8,
              fontWeight: 700,
              border: 0,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in…' : 'Login'}
          </button>

          {msg && <div style={{ color: '#b91c1c', marginTop: 8 }}>{msg}</div>}

          <div style={{ marginTop: 8, fontSize: 14, color: '#64748b' }}>
            New here?{' '}
            <Link href="/signup" style={{ color: '#0f4a8a', fontWeight: 600 }}>
              Create an account
            </Link>
          </div>
        </div>
      </form>

      <div style={{ marginTop: 18 }}>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-block',
            background: '#0f4a8a',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 8,
            fontWeight: 700,
          }}
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
