'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getStoredToken, setAuthToken, Profile } from '@/lib/api';

type Brain = 'CFO' | 'COO' | 'CMO' | 'CHRO';

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [text, setText] = useState<string>('');
  const [brains, setBrains] = useState<Record<Brain, boolean>>({
    CFO: true,
    COO: false,
    CMO: false,
    CHRO: false,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<Record<string, string>>({});

  // Load token + profile
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace('/');
      return;
    }
    setAuthToken(token);
    (async () => {
      try {
        const { data } = await api.get<Profile>('/api/profile');
        setProfile(data);
      } catch {
        router.replace('/');
      }
    })();
  }, [router]);

  const demoMode = useMemo(() => {
    if (!profile) return true;
    return !profile.is_paid && !profile.is_admin;
  }, [profile]);

  const selectedBrains = useMemo(
    () => (Object.keys(brains) as Brain[]).filter(b => brains[b]),
    [brains]
  );

  function toggleBrain(b: Brain) {
    setBrains(prev => ({ ...prev, [b]: !prev[b] }));
  }

  async function runAnalysis(e: FormEvent) {
    e.preventDefault();
    if (demoMode) return; // blocked in demo

    setLoading(true);
    setResult({});
    try {
      const { data } = await api.post<{ insights: Record<string, string>; tokens_used: number }>(
        '/api/analyze',
        { text, brains: selectedBrains }
      );
      setResult(data.insights ?? {});
    } catch (err) {
      setResult({ error: 'Analysis failed. If you are on the free plan, please upgrade.' });
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setAuthToken(null);
    router.replace('/');
  }

  if (!profile) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-600">
              Welcome, <span className="font-semibold">{profile.email}</span>
              {profile.is_admin ? (
                <span className="ml-2 inline-block rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs">
                  Admin
                </span>
              ) : (
                <span className="ml-2 inline-block rounded bg-slate-100 text-slate-800 px-2 py-0.5 text-xs">
                  Free
                </span>
              )}
            </p>
          </div>

          <div className="flex gap-2">
            {profile.is_admin && (
              <Link
                href="/admin"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 bg-white hover:bg-slate-50"
              >
                Admin
              </Link>
            )}
            <button
              onClick={logout}
              className="rounded-md bg-blue-800 hover:bg-blue-900 text-white px-3 py-1.5 text-sm font-semibold"
            >
              Log out
            </button>
          </div>
        </header>

        {demoMode && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
            <strong>Demo mode:</strong> analysis is disabled on the free plan. Upgrade to unlock all brains.
          </div>
        )}

        <form onSubmit={runAnalysis} className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-slate-600">Paste content to analyze</span>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              className="w-full rounded-lg border border-slate-300 p-3"
              placeholder="Paste a report, transcript, or notes…"
            />
          </label>

          <div className="text-sm text-slate-700">Choose brains</div>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(brains) as Brain[]).map(b => (
              <label key={b} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={brains[b]}
                  onChange={() => toggleBrain(b)}
                />
                <span>{b}</span>
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={demoMode || loading || text.trim().length === 0}
            className="mt-1 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-semibold px-4 py-2 disabled:opacity-60"
          >
            {loading ? 'Running…' : demoMode ? 'Upgrade to run analysis' : 'Run analysis'}
          </button>
        </form>

        {Object.keys(result).length > 0 && (
          <section className="mt-6 grid gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Insights</h2>
            {Object.entries(result).map(([brain, insight]) => (
              <div key={brain} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-sm font-semibold text-slate-800 mb-1">{brain}</div>
                <pre className="whitespace-pre-wrap text-slate-700 text-sm">{insight}</pre>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
