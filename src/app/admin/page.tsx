"use client";
import { useEffect, useMemo, useState } from "react";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

/* ---------------- Types ---------------- */
type Tier = "admin" | "premium" | "pro_plus" | "pro" | "demo";

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
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(n);
  } catch {
    return `$${n.toFixed(4)}`;
  }
}

function tierBadge(t: Tier | string) {
  const norm = String(t).toLowerCase();
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

  // KPIs
  const [summary, setSummary] = useState<Summary | null>(null);

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
        setSummary(null); // we'll fall back to roster-derived counts
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

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      await Promise.all([loadSummary(), loadRoster(1, pageSize, q)]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    loadRoster(1, pageSize, q);
  }

  const total = data?.total ?? 0;
  const maxPage = Math.max(1, Math.ceil(total / (pageSize || 1)));
  const items = data?.items || [];

  // Fallback KPIs from current page if /summary isn’t available
  const derived = useMemo(() => {
  const counts = { demo: 0, pro: 0, pro_plus: 0, premium: 0 };
  for (const u of items) {
    const t = String(u.tier || "").toLowerCase();
    if (t === "admin" || t === "premium") counts.premium += 1;
    else if (t === "pro_plus") counts.pro_plus += 1;
    else if (t === "pro") counts.pro += 1;
    else counts.demo += 1;
  }
  return counts;
}, [items]);

  const k_total   = summary?.total_users ?? total;
  const k_demo    = summary?.demo ?? derived.demo;
  const k_pro     = summary?.pro ?? derived.pro;
  const k_proplus = (summary as any)?.pro_plus ?? derived.pro_plus;
  const k_premium = summary?.premium ?? derived.premium;

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

      {/* KPI tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, margin: "12px 0 16px" }}>
        <Tile title="Total users" value={String(k_total)} />
        <Tile title="Demo" value={String(k_demo)} />
        <Tile title="Pro" value={String(k_pro)} />
        <Tile title="Pro+" value={String(k_proplus)} />
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
              loadRoster(1, ps, q);
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
            setPage(1);
            loadRoster(1, pageSize, "");
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
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              if (page <= 1 || busy) return;
              const p = page - 1;
              setPage(p);
              loadRoster(p, pageSize, q);
            }}
            disabled={busy || page <= 1}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "#111827",
              border: "1px solid #243044",
              color: "#e5e7eb",
              opacity: busy || page <= 1 ? 0.6 : 1,
            }}
          >
            Prev
          </button>
          <button
            onClick={() => {
              if (page >= maxPage || busy) return;
              const p = page + 1;
              setPage(p);
              loadRoster(p, pageSize, q);
            }}
            disabled={busy || page >= maxPage}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "#111827",
              border: "1px solid #243044",
              color: "#e5e7eb",
              opacity: busy || page >= maxPage ? 0.6 : 1,
            }}
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}

/* ---------------- Tiny tile ---------------- */
function Tile({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: "1px solid #243044", background: "#0e1320", borderRadius: 10, padding: 12 }}>
      <div style={{ opacity: 0.7, fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: 13,
  borderBottom: "1px solid #243044",
};
const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13 };
