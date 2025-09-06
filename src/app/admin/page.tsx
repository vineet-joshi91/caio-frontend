"use client";
import { useEffect, useMemo, useState } from "react";

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
  tier: Tier;
  is_admin: boolean;
  is_paid: boolean;
  managed: "env" | "db";
  created_at?: string | null;
  last_seen?: string | null;
  count_24h?: number;
  analyze_24h?: number;
  chat_24h?: number;
  count_7d?: number;
  can_toggle_paid: boolean;
};

type RosterResp = {
  page: number;
  page_size: number;
  total: number;
  items: RosterItem[];
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

function tierBadge(t: Tier) {
  const label = t === "admin" || t === "premium" ? "Premium" : t === "pro" ? "Pro" : "Demo";
  const bg =
    t === "admin" || t === "premium"
      ? { bg: "#103a2c", br: "#1b5c47", fg: "#b9f2dd" }
      : t === "pro"
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
  const [actionMsg, setActionMsg] = useState<string | null>(null);

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

  const isAdmin = (me?.tier === "admin");

  async function loadRoster(p = page, ps = pageSize, query = q) {
    if (!token) return;
    setBusy(true);
    setActionMsg(null);
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
    if (isAdmin) loadRoster(1, pageSize, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function togglePaid(email: string, next: boolean) {
    if (!confirm(`${next ? "Grant" : "Revoke"} Pro for ${email}?`)) return;
    setBusy(true);
    setActionMsg(null);
    setErr(null);
    try {
      const r = await fetch(`${API_BASE}/api/admin/users/set-paid`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, is_paid: next }),
      });
      const body = await r.text();
      if (!r.ok) throw new Error(body || `HTTP ${r.status}`);
      setActionMsg(`Updated: ${email} → ${next ? "Pro" : "Demo"}`);
      await loadRoster(page, pageSize, q);
    } catch (e: any) {
      setErr(String(e?.message || e) || "Could not update user.");
    } finally {
      setBusy(false);
    }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    loadRoster(1, pageSize, q);
  }

  const total = data?.total ?? 0;
  const maxPage = Math.max(1, Math.ceil(total / (pageSize || 1)));
  const items = data?.items || [];

  // derived mini-metrics from roster (replacing old /api/admin/metrics)
  const m_total = total;
  const m_premium = items.filter((u) => u.tier === "admin" || u.tier === "premium").length;
  const m_pro = items.filter((u) => u.tier === "pro").length;
  const m_active24h = items.filter((u) => (u.count_24h ?? 0) > 0).length;

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

      {/* mini tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, margin: "12px 0 16px" }}>
        <Tile title="Total users" value={String(m_total)} />
        <Tile title="Active in last 24h" value={String(m_active24h)} />
        <Tile title="Premium (Admin+Premium)" value={String(m_premium)} />
        <Tile title="Pro (DB managed)" value={String(m_pro)} />
      </div>

      {loading && <div style={{ margin: "10px 0" }}>Loading…</div>}
      {err && (
        <div style={{ margin: "10px 0", padding: 10, border: "1px solid #5a3535", background: "#331b1b" }}>
          {err}
        </div>
      )}
      {actionMsg && (
        <div style={{ margin: "10px 0", padding: 10, border: "1px solid #1b5c47", background: "#0f2c22", color: "#b9f2dd" }}>
          {actionMsg}
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
              <th style={th}>Managed</th>
              <th style={th}>Created</th>
              <th style={th}>Last seen</th>
              <th style={{ ...th, textAlign: "right" }}>24h (Analyze/Chat)</th>
              <th style={{ ...th, textAlign: "right" }}>7d total</th>
              <th style={{ ...th, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {busy && items.length === 0 ? (
              <tr>
                <td style={td} colSpan={8}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td style={td} colSpan={8}>
                  No users found
                </td>
              </tr>
            ) : (
              items.map((u) => {
                const nextPaid = !u.is_paid;
                const canToggle = u.can_toggle_paid && u.managed === "db";
                return (
                  <tr key={u.email} style={{ borderTop: "1px solid #243044" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{u.email}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>{u.is_admin ? "Admin" : "User"} • {u.is_paid ? "Paid" : "Unpaid"}</div>
                    </td>
                    <td style={td}>{tierBadge(u.tier)}</td>
                    <td style={td}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid #243044",
                          background: "#0e1320",
                          fontSize: 12,
                        }}
                      >
                        {u.managed === "env" ? "Env" : "DB"}
                      </span>
                    </td>
                    <td style={td}>{fmtDate(u.created_at)}</td>
                    <td style={td}>{fmtDate(u.last_seen)}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {(u.analyze_24h ?? 0)}/{(u.chat_24h ?? 0)}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{u.count_7d ?? 0}</span>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {u.managed === "env" ? (
                        <span style={{ opacity: 0.6, fontSize: 12 }}>Managed by env</span>
                      ) : (
                        <button
                          disabled={busy || !canToggle}
                          onClick={() => togglePaid(u.email, nextPaid)}
                          title={nextPaid ? "Grant Pro" : "Revoke Pro"}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: nextPaid ? "#0b3a5c" : "#5c3a0b",
                            border: `1px solid ${nextPaid ? "#134d77" : "#6a4a12"}`,
                            color: "#e5e7eb",
                            opacity: busy || !canToggle ? 0.6 : 1,
                            fontSize: 12,
                          }}
                        >
                          {nextPaid ? "Make Pro" : "Revoke Pro"}
                        </button>
                      )}
                    </td>
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
          Page <b>{page}</b> of <b>{maxPage}</b> • {total} users
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
            style={{ padding: "8px 12px", borderRadius: 8, background: "#111827", border: "1px solid #243044", color: "#e5e7eb", opacity: busy || page <= 1 ? 0.6 : 1 }}
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
            style={{ padding: "8px 12px", borderRadius: 8, background: "#111827", border: "1px solid #243044", color: "#e5e7eb", opacity: busy || page >= maxPage ? 0.6 : 1 }}
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
