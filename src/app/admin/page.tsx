"use client";
import { useEffect, useMemo, useState } from "react";

/* ---------------- Config ---------------- */
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-orchestrator.onrender.com";

/* ---------------- Types ---------------- */
type Tier = "admin" | "premium" | "pro_plus" | "pro" | "demo";

type Me = {
  email: string;
  tier: Tier | string;
  is_admin?: boolean;
  is_paid?: boolean;
  created_at?: string | null;
};

type KPIResp = {
  total_users: number;
  new_users_7d: number;
  dau_today: number;
  wau_7d: number;
  mau_30d: number;
  latest_usage_log_ts: string | null;
};

type UsersResp = {
  total: number;
  items: Array<{
    user_id: number;
    email: string;
    tier: Tier | string;
    is_admin?: boolean;
    is_test?: boolean;
    is_paid?: boolean;
    billing_currency?: string | null;
    plan_tier?: string | null;
    plan_status?: string | null;
    created_at?: string | null;
    last_active_at?: string | null;
    events_30d?: number;
  }>;
};

type UsageDailyResp = {
  items: Array<{ day: string; endpoint: string; events: number; dau: number }>;
};

type SignupsResp = {
  items: Array<{ day: string; signups: number }>;
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
  const d = new Date(s);
  return isNaN(d.getTime()) ? s! : d.toLocaleString();
}

function tierBadge(t: Tier | string) {
  const norm = String(t || "").toLowerCase();
  const label =
    norm === "admin" || norm === "premium" ? "Premium" :
    norm === "pro_plus" ? "Pro+" :
    norm === "pro" ? "Pro" : "Demo";
  const style =
    norm === "admin" || norm === "premium"
      ? { bg: "#103a2c", br: "#1b5c47", fg: "#b9f2dd" }
      : norm === "pro_plus"
      ? { bg: "#12223d", br: "#2a4d8a", fg: "#d7e6ff" }
      : norm === "pro"
      ? { bg: "#0b2d46", br: "#134d77", fg: "#c7e7ff" }
      : { bg: "#3e2c0b", br: "#6a4a12", fg: "#ffe3b0" };
  return (
    <span style={{
      padding:"2px 8px", borderRadius:999, border:`1px solid ${style.br}`,
      background:style.bg, color:style.fg, fontSize:12, whiteSpace:"nowrap"
    }}>
      {label}
    </span>
  );
}

/* ---------------- Page ---------------- */
export default function AdminDashboard() {
  // auth/profile
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // kpis & series
  const [kpis, setKpis] = useState<KPIResp | null>(null);
  const [usage, setUsage] = useState<UsageDailyResp["items"]>([]);
  const [signups, setSignups] = useState<SignupsResp["items"]>([]);

  // users table
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"last_active_at_desc" | "created_at_desc">("last_active_at_desc");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [users, setUsers] = useState<UsersResp | null>(null);
  const [busy, setBusy] = useState(false);

  const token = useMemo(getToken, []);

  // load profile (and enforce admin)
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
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
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

  const isAdmin = !!(me?.is_admin || me?.tier === "admin" || me?.tier === "premium");

  // load kpis, users, series
  useEffect(() => {
    if (!isAdmin || !token) return;
    (async () => {
      setErr(null);
      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [k, u, ud, s] = await Promise.all([
          fetch(`${API_BASE}/api/admin/kpis`, { headers, cache: "no-store" }).then(r => r.json()),
          fetch(`${API_BASE}/api/admin/users?sort=${sort}&limit=${limit}&offset=${offset}${q ? `&q=${encodeURIComponent(q)}` : ""}`, { headers, cache: "no-store" }).then(r => r.json()),
          fetch(`${API_BASE}/api/admin/usage-daily?days=30`, { headers, cache: "no-store" }).then(r => r.json()),
          fetch(`${API_BASE}/api/admin/signups-30d`, { headers, cache: "no-store" }).then(r => r.json()),
        ]);

        setKpis(k);
        setUsers(u);
        setUsage(ud.items || []);
        setSignups(s.items || []);
      } catch (e: any) {
        setErr(String(e?.message || e) || "Failed to load admin data.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, token, sort, limit, offset]);

  async function reloadUsers(newQ = q, newLimit = limit, newOffset = 0) {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const u = await fetch(
        `${API_BASE}/api/admin/users?sort=${sort}&limit=${newLimit}&offset=${newOffset}${newQ ? `&q=${encodeURIComponent(newQ)}` : ""}`,
        { headers, cache: "no-store" }
      ).then(r => r.json());
      setUsers(u);
      setOffset(newOffset);
      setLimit(newLimit);
      setQ(newQ);
    } catch (e: any) {
      setErr(String(e?.message || e) || "Failed to load users.");
    } finally {
      setBusy(false);
    }
  }

  const total = users?.total ?? 0;
  const items = users?.items ?? [];
  const page = Math.floor(offset / (limit || 1)) + 1;
  const maxPage = Math.max(1, Math.ceil(total / (limit || 1)));

  return (
    <main style={{ minHeight: "100vh", background: "#0b0f1a", color: "#e5e7eb", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Admin — Overview</h1>
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

      {/* KPI tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, margin: "12px 0 16px" }}>
        <Tile title="Total users" value={String(kpis?.total_users ?? 0)} />
        <Tile title="New (7d)" value={String(kpis?.new_users_7d ?? 0)} />
        <Tile title="DAU (today)" value={String(kpis?.dau_today ?? 0)} />
        <Tile title="WAU (7d)" value={String(kpis?.wau_7d ?? 0)} />
        <Tile title="MAU (30d)" value={String(kpis?.mau_30d ?? 0)} />
        <Tile title="Latest activity" value={kpis?.latest_usage_log_ts ? fmtDate(kpis.latest_usage_log_ts) : "—"} />
      </div>

      {loading && <div style={{ margin: "10px 0" }}>Loading…</div>}
      {err && (
        <div style={{ margin: "10px 0", padding: 10, border: "1px solid #5a3535", background: "#331b1b" }}>
          {err}
        </div>
      )}

      {/* Users controls */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          reloadUsers(q, limit, 0);
        }}
        style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 12 }}
      >
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
          <div style={{ opacity: 0.8, fontSize: 12 }}>Sort</div>
          <select
            value={sort}
            onChange={(e) => {
              const s = (e.target.value as typeof sort) || "last_active_at_desc";
              setSort(s);
              reloadUsers(q, limit, 0);
            }}
            style={{
              marginTop: 4,
              padding: "10px 12px",
              borderRadius: 10,
              background: "#0b0f1a",
              border: "1px solid #243044",
              color: "#e5e7eb",
            }}
          >
            <option value="last_active_at_desc">Last active ↓</option>
            <option value="created_at_desc">Created ↓</option>
          </select>
        </div>

        <div>
          <div style={{ opacity: 0.8, fontSize: 12 }}>Page size</div>
          <select
            value={limit}
            onChange={(e) => {
              const ps = parseInt(e.target.value || "25", 10);
              setLimit(ps);
              reloadUsers(q, ps, 0);
            }}
            style={{
              marginTop: 4,
              padding: "10px 12px",
              borderRadius: 10,
              background: "#0b0f1a",
              border: "1px solid #243044",
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
            setSort("last_active_at_desc");
            reloadUsers("", limit, 0);
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

      {/* Users table */}
      <div style={{ overflow: "auto", border: "1px solid #243044", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#0e1320" }}>
              <th style={th}>Email</th>
              <th style={th}>Tier</th>
              <th style={th}>Created</th>
              <th style={th}>Last active</th>
              <th style={{ ...th, textAlign: "right" }}>30d events</th>
            </tr>
          </thead>
          <tbody>
            {busy && items.length === 0 ? (
              <tr>
                <td style={td} colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td style={td} colSpan={5}>
                  No users found
                </td>
              </tr>
            ) : (
              items.map((u) => (
                <tr key={u.user_id ?? u.email} style={{ borderTop: "1px solid #243044" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{u.email}</div>
                  </td>
                  <td style={td}>{tierBadge(u.tier)}</td>
                  <td style={td}>{fmtDate(u.created_at)}</td>
                  <td style={td}>{fmtDate(u.last_active_at)}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {u.events_30d ?? 0}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Page <b>{page}</b> of <b>{maxPage}</b> • {total} user{total === 1 ? "" : "s"}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              if (page <= 1 || busy) return;
              const newOffset = Math.max(0, offset - limit);
              reloadUsers(q, limit, newOffset);
            }}
            disabled={busy || page <= 1}
            style={btnPager(busy || page <= 1)}
          >
            Prev
          </button>
          <button
            onClick={() => {
              if (page >= maxPage || busy) return;
              const newOffset = offset + limit;
              reloadUsers(q, limit, newOffset);
            }}
            disabled={busy || page >= maxPage}
            style={btnPager(busy || page >= maxPage)}
          >
            Next
          </button>
        </div>
      </div>

      {/* Usage + Signups */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }}>
        <div>
          <h2 style={{ marginBottom: 8 }}>Usage (last 30 days)</h2>
          <table width="100%" cellPadding={8} style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #444" }}>
                <th>Day</th><th>Endpoint</th><th>Events</th><th>DAU</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((r, i) => (
                <tr key={`${r.day}-${r.endpoint}-${i}`} style={{ borderBottom: "1px solid #333" }}>
                  <td>{r.day}</td><td>{r.endpoint}</td><td>{r.events}</td><td>{r.dau}</td>
                </tr>
              ))}
              {usage.length === 0 && <tr><td colSpan={4} style={{ opacity: 0.7 }}>No data.</td></tr>}
            </tbody>
          </table>
        </div>
        <div>
          <h2 style={{ marginBottom: 8 }}>Signups (last 30 days)</h2>
          <table width="100%" cellPadding={8} style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #444" }}>
                <th>Day</th><th>Signups</th>
              </tr>
            </thead>
            <tbody>
              {signups.map((r, i) => (
                <tr key={`${r.day}-${i}`} style={{ borderBottom: "1px solid #333" }}>
                  <td>{r.day}</td><td>{r.signups}</td>
                </tr>
              ))}
              {signups.length === 0 && <tr><td colSpan={2} style={{ opacity: 0.7 }}>No data.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

/* ---------------- Tiny components/styles ---------------- */
function Tile({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: "1px solid #243044", background: "#0e1320", borderRadius: 10, padding: 12 }}>
      <div style={{ opacity: 0.7, fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function btnPager(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    background: "#111827",
    border: "1px solid #243044",
    color: "#e5e7eb",
    opacity: disabled ? 0.6 : 1,
  };
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: 13,
  borderBottom: "1px solid #243044",
};

const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13 };
