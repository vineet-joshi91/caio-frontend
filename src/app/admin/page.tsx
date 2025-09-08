"use client";
import { useEffect, useMemo, useState } from "react";

/* ---------------- Config ---------------- */
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

/* ---------------- Types ---------------- */
type Tier = "admin" | "premium" | "pro" | "demo";

type Me = {
  email: string;
  tier: Tier;
  is_admin?: boolean;
  is_paid?: boolean;
  created_at?: string | null;
};

type RosterItem = {
  email: string;
  tier: Tier | string;
  created_at?: string | null;
  last_seen?: string | null;
  total_sessions?: number;
  spend_usd?: number;
};

type RosterResp = {
  page: number;
  page_size: number;
  total: number;
  items: RosterItem[];
};

type Summary = {
  total_users: number;
  demo: number;
  pro: number;
  premium: number;
};

type MetricsTotals = {
  today: number;
  all_time: number;
  active_paid: number;
  active_inr: number | null;
  active_usd: number | null;
  cancelled_7d: number;
  free_cap_hits_today: number;
};

type MetricsSeries = { date: string; endpoint: string; tier: string; count: number };

type MetricsResp = {
  totals: MetricsTotals;
  series: MetricsSeries[];
  mrr: Record<string, number>;
  notes?: string;
};

/* ---------------- Utils ---------------- */
function getToken(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : localStorage.getItem("token") || localStorage.getItem("access_token");
  } catch {
    return null;
  }
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s!;
  }
}

function fmtUSD(v?: number) {
  const n = Number.isFinite(v as number) ? (v as number) : 0;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function fmtINR(v?: number) {
  const n = Number.isFinite(v as number) ? (v as number) : 0;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `₹${Math.round(n)}`;
  }
}

function tierBadge(t: Tier | string) {
  const norm = String(t).toLowerCase();
  const label = norm === "admin" || norm === "premium" ? "Premium" : norm === "pro" ? "Pro" : "Demo";
  const bg =
    norm === "admin" || norm === "premium"
      ? { bg: "#103a2c", br: "#1b5c47", fg: "#b9f2dd" }
      : norm === "pro"
      ? { bg: "#0b2d46", br: "#134d77", fg: "#c7e7ff" }
      : { bg: "#3e2c0b", br: "#6a4a12", fg: "#ffe3b0" };
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        border: `1px solid ${bg.br}`,
        background: bg.bg,
        color: bg.fg,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

/* ---------------- Page ---------------- */
export default function AdminUsers() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // table state
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<RosterResp | null>(null);
  const [busy, setBusy] = useState(false);

  // KPIs (users summary)
  const [summary, setSummary] = useState<Summary | null>(null);

  // Admin metrics (Overview)
  const [metrics, setMetrics] = useState<MetricsResp | null>(null);
  const [mBusy, setMBusy] = useState(false);

  const token = useMemo(getToken, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        if (!token) {
          window.location.href = "/login";
          return;
        }
        const r = await fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const j = await r.json();
        setMe({
          email: j.email,
          tier: j.tier,
          is_admin: !!j.is_admin,
          is_paid: !!j.is_paid,
          created_at: j.created_at,
        });
      } catch (e: any) {
        setErr(String(e?.message || e) || "Couldn’t load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const isAdmin = me?.tier === "admin";

  async function loadSummary() {
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/users/summary`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!r.ok) {
        setSummary(null);
        return;
      }
      const j: Summary = await r.json();
      setSummary(j);
    } catch {
      setSummary(null);
    }
  }

  async function loadRoster(p = page, ps = pageSize, query = q) {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const u = new URL(`${API_BASE}/api/admin/users/roster`);
      u.searchParams.set("page", String(p));
      u.searchParams.set("page_size", String(ps));
      if (query.trim()) u.searchParams.set("q", query.trim());

      const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const body = await r.text();
      if (!r.ok) throw new Error(body || `HTTP ${r.status}`);
      const j: RosterResp = JSON.parse(body || "{}");
      setData(j);
      setPage(p);
      setPageSize(ps);
    } catch (e: any) {
      setErr(String(e?.message || e) || "Failed to load users.");
    } finally {
      setBusy(false);
    }
  }

  async function loadMetrics() {
    if (!token) return;
    setMBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!r.ok) {
        setMetrics(null);
        return;
      }
      const j: MetricsResp = await r.json();
      setMetrics(j);
    } catch {
      setMetrics(null);
    } finally {
      setMBusy(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      await Promise.all([loadSummary(), loadRoster(1, pageSize, q), loadMetrics()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void loadRoster(1, pageSize, q);
  }

  const total = data?.total ?? 0;
  const maxPage = Math.max(1, Math.ceil(total / (pageSize || 1)));
  const items = data?.items || [];

  // Fallback KPIs from current page if /summary isn’t available
  const derived = useMemo(() => {
    const counts = { demo: 0, pro: 0, premium: 0 };
    for (const u of items) {
      const t = String(u.tier || "").toLowerCase();
      if (t === "admin" || t === "premium") counts.premium += 1;
      else if (t === "pro") counts.pro += 1;
      else counts.demo += 1;
    }
    return counts;
  }, [items]);

  const k_total = summary?.total_users ?? total;
  const k_demo = summary?.demo ?? derived.demo;
  const k_pro = summary?.pro ?? derived.pro;
  const k_premium = summary?.premium ?? derived.premium;

  // ------- Metrics render helpers -------
  const m = metrics?.totals;
  const mrrINR = metrics?.mrr?.INR || 0;
  const mrrUSD = metrics?.mrr?.USD || 0;
  const mrrTotalText = `${fmtINR(mrrINR)} + ${fmtUSD(mrrUSD)}`;

  // Build date -> endpoint -> count map for bars
  const chartData = useMemo(() => {
    if (!metrics?.series?.length) {
      return {
        dates: [] as string[],
        byDate: {} as Record<string, Record<string, number>>,
        endpoints: [] as string[],
      };
    }
    const datesSet = new Set<string>();
    const endpointsSet = new Set<string>();
    const byDate: Record<string, Record<string, number>> = {};
    for (const row of metrics.series) {
      const d = row.date;
      const ep = row.endpoint || "other";
      datesSet.add(d);
      endpointsSet.add(ep);
      byDate[d] = byDate[d] || {};
      byDate[d][ep] = (byDate[d][ep] || 0) + (row.count || 0);
    }
    const dates = Array.from(datesSet).sort();
    const endpoints = Array.from(endpointsSet);
    return { dates, byDate, endpoints };
  }, [metrics]);

  const maxPerDay = useMemo(() => {
    if (!chartData.dates.length) return 0;
    return chartData.dates.reduce((mx, d) => {
      const dayTotal = Object.values(chartData.byDate[d] || {}).reduce((a, b) => a + b, 0);
      return Math.max(mx, dayTotal);
    }, 0);
  }, [chartData]);

  return (
    <main style={{ minHeight: "100vh", background: "#0b0f1a", color: "#e5e7eb", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Admin — Users</h1>
        {/* Admin Mode badge */}
        {isAdmin && (
          <span
            title="You are viewing Admin-only data"
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid #1b5c47",
              background: "#103a2c",
              color: "#b9f2dd",
              fontSize: 12,
            }}
          >
            ADMIN MODE
          </span>
        )}
      </div>

      {/* NEW: Overview / metrics */}
      {isAdmin && (
        <>
          <h2 style={{ margin: "18px 0 8px", fontSize: 16, opacity: 0.9 }}>Overview</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 12 }}>
            <Tile title="Active paid" value={String(m?.active_paid ?? 0)} />
            <Tile title="Active (INR)" value={String(m?.active_inr ?? 0)} />
            <Tile title="Active (USD)" value={String(m?.active_usd ?? 0)} />
            <Tile title="Cancellations (7d)" value={String(m?.cancelled_7d ?? 0)} />
            <Tile title="Free cap hits (today)" value={String(m?.free_cap_hits_today ?? 0)} />
            <Tile title="MRR (INR + USD)" value={mrrTotalText} />
          </div>

          {/* Simple daily usage by endpoint (stacked bars) */}
          <div style={{ border: "1px solid #243044", borderRadius: 10, padding: 12, background: "#0e1320" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontWeight: 700 }}>Daily usage by endpoint</div>
              {mBusy && <span style={{ fontSize: 12, opacity: 0.7 }}>Loading…</span>}
            </div>
            {!chartData.dates.length ? (
              <div style={{ padding: "10px 0", opacity: 0.8, fontSize: 13 }}>No usage yet.</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 12, marginTop: 10, overflowX: "auto" }}>
                  {chartData.dates.map((d) => {
                    const buckets = chartData.byDate[d] || {};
                    const total = Object.values(buckets).reduce((a, b) => a + b, 0);
                    return (
                      <div key={d} style={{ minWidth: 36, textAlign: "center" }}>
                        {/* stacked column */}
                        <div
                          style={{
                            height: 140,
                            width: 28,
                            display: "flex",
                            flexDirection: "column-reverse",
                            border: "1px solid #243044",
                            borderRadius: 6,
                            overflow: "hidden",
                            margin: "0 auto",
                            background: "#0b0f1a",
                          }}
                          title={`${d} • ${total} total`}
                        >
                          {chartData.endpoints.map((ep) => {
                            const val = buckets[ep] || 0;
                            const h = maxPerDay ? Math.round((val / maxPerDay) * 138) : 0;
                            const color = ep === "analyze" ? "#355be2" : ep === "chat" ? "#22c55e" : "#a855f7";
                            return val > 0 ? (
                              <div key={`${d}-${ep}`} style={{ height: h, background: color }} title={`${ep}: ${val}`} />
                            ) : null;
                          })}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 11, opacity: 0.8 }}>{d.slice(5)}</div>
                      </div>
                    );
                  })}
                </div>
                {/* legend */}
                <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                  {chartData.endpoints.map((ep) => {
                    const color = ep === "analyze" ? "#355be2" : ep === "chat" ? "#22c55e" : "#a855f7";
                    return (
                      <span key={`lg-${ep}`} style={{ fontSize: 12, opacity: 0.85 }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: 10,
                            height: 10,
                            background: color,
                            borderRadius: 2,
                            marginRight: 6,
                          }}
                        />
                        {ep}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* KPI tiles for users breakdown (existing) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, margin: "12px 0 16px" }}>
        <Tile title="Total users" value={String(k_total)} />
        <Tile title="Demo" value={String(k_demo)} />
        <Tile title="Pro" value={String(k_pro)} />
        <Tile title="Premium (Admin+Premium)" value={String(k_premium)} />
      </div>

      {loading && <div style={{ margin: "10px 0" }}>Loading…</div>}
      {err && (
        <div style={{ margin: "10px 0", padding: 10, border: "1px solid #5a3535", background: "#331b1b" }}>
          {err}
        </div>
      )}

      {/* controls */}
      <form onSubmit={onSearch} style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ opacity: 0.8, fontSize: 12 }}>Search by email</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. @acme.com"
            style={{
              marginTop: 4,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              background: "#0b0f1a",
              border: "1px solid #243044",
              color: "#e5e7eb",
            }}
          />
        </div>
        <div>
          <div style={{ opacity: 0.8, fontSize: 12 }}>Page size</div>
          <select
            value={pageSize}
            onChange={(e) => {
              const ps = parseInt(e.target.value || "25", 10);
              setPageSize(ps);
              setPage(1);
              void loadRoster(1, ps, q);
            }}
            style={{
              marginTop: 4,
              padding: "10px 12px",
              borderRadius: 10,
              background: "#0b0f1a",
              border: "1px solid #243044", // (fixed string)
              color: "#e5e7eb",
            }}
          >
            {[10, 25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "#1f4fd1",
            border: "1px solid #355be2",
            color: "white",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Loading…" : "Search"}
        </button>
        <button
          type="button"
          onClick={() => {
            setQ("");
            setPage(1);
            void loadRoster(1, pageSize, "");
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "#111827",
            border: "1px solid #243044",
            color: "#e5e7eb",
          }}
        >
          Clear
        </button>
      </form>

      {/* table */}
      <div style={{ overflow: "auto", border: "1px solid #243044", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#0e1320" }}>
              <th style={th}>Email</th>
              <th style={th}>Tier</th>
              <th style={th}>Created</th>
              <th style={th}>Last seen</th>
              <th style={{ ...th, textAlign: "right" }}>Total sessions</th>
              <th style={{ ...th, textAlign: "right" }}>Tokens used (money)</th>
            </tr>
          </thead>
          <tbody>
            {busy && items.length === 0 ? (
              <tr>
                <td style={td} colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td style={td} colSpan={6}>
                  No users found
                </td>
              </tr>
            ) : (
              items.map((u) => {
                const sessions = Number.isFinite(u.total_sessions as number) ? (u.total_sessions as number) : 0;
                const spend = Number.isFinite(u.spend_usd as number) ? (u.spend_usd as number) : 0;
                return (
                  <tr key={u.email} style={{ borderTop: "1px solid #243044" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{u.email}</div>
                    </td>
                    <td style={td}>{tierBadge(u.tier)}</td>
                    <td style={td}>{fmtDate(u.created_at)}</td>
                    <td style={td}>{fmtDate(u.last_seen)}</td>
                    <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{sessions}</td>
                    <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(spend)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Page <b>{page}</b> of <b>{maxPage}</b> • {total} user{total === 1 ? "" : "s"}
        </div>
        <div style={{ display: "flex", gap: 8
