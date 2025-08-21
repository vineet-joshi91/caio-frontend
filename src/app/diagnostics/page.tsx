"use client";

import { useEffect, useMemo, useState } from "react";

/** ====== CONFIG ====== */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "(missing)";
const FETCH_TIMEOUT_MS = 9000;

/** ====== UTILS ====== */
function toJSON(x: any) {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

function withTimeout<T>(p: Promise<T>, ms = FETCH_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

type CheckResult =
  | { ok: true; status?: number; statusText?: string; data?: any }
  | { ok: false; status?: number; statusText?: string; error: string; data?: any };

async function getJSON(url: string, init?: RequestInit): Promise<CheckResult> {
  try {
    const r = await withTimeout(fetch(url, init));
    const ct = r.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await r.json() : await r.text();
    if (!r.ok) {
      return {
        ok: false,
        status: r.status,
        statusText: r.statusText,
        error: `HTTP ${r.status} ${r.statusText}`,
        data: body,
      };
    }
    return { ok: true, status: r.status, statusText: r.statusText, data: body };
  } catch (e: any) {
    // Normalize common browser/network/CORS errors
    const msg = String(e?.message || e);
    const hint =
      msg.includes("Failed to fetch") || msg.includes("TypeError: NetworkError")
        ? "Network/CORS? (origin not allowed or server down)"
        : msg.includes("timeout")
        ? "Timeout (server slow, DNS, or blocked by CORS)"
        : undefined;
    return { ok: false, error: hint ? `${msg} · ${hint}` : msg };
  }
}

function readToken(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch {}
  try {
    const v = localStorage.getItem("token");
    if (v) return v;
  } catch {}
  return null;
}

function decodeJwtPayload(token?: string | null): any | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function Badge({ state }: { state: "OK" | "WARN" | "FAIL" | "PENDING" }) {
  const color =
    state === "OK"
      ? "#22c55e"
      : state === "WARN"
      ? "#f59e0b"
      : state === "FAIL"
      ? "#ef4444"
      : "#64748b";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: `1px solid ${color}55`,
        color,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      ● {state}
    </span>
  );
}

function Row({
  title,
  result,
  description,
  children,
}: {
  title: string;
  result?: CheckResult;
  description?: string;
  children?: React.ReactNode;
}) {
  const state: "OK" | "WARN" | "FAIL" | "PENDING" = !result
    ? "PENDING"
    : result.ok
    ? "OK"
    : result.status && result.status >= 500
    ? "FAIL"
    : result.status && result.status >= 400
    ? "WARN"
    : "FAIL";
  return (
    <div style={{ border: "1px solid #243044", borderRadius: 12, padding: 14, background: "#0e1320" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800 }}>{title}</div>
          {description ? <div style={{ opacity: 0.75, fontSize: 12 }}>{description}</div> : null}
        </div>
        <Badge state={state} />
      </div>
      {result ? (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {"status" in result && result.status !== undefined ? (
            <div style={{ opacity: 0.8, fontSize: 12 }}>
              HTTP: {result.status} {result.statusText || ""}
            </div>
          ) : null}
          {"error" in result && result.error ? (
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                background: "#1b2234",
                border: "1px solid #2b3650",
                borderRadius: 8,
                padding: 10,
                color: "#fca5a5",
              }}
            >
              {result.error}
            </pre>
          ) : null}
          {"data" in result ? (
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                background: "#0d1220",
                border: "1px solid #23304a",
                borderRadius: 8,
                padding: 10,
                color: "#e5e7eb",
              }}
            >
              {toJSON(result.data)}
            </pre>
          ) : null}
          {children}
        </div>
      ) : (
        <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>running…</div>
      )}
    </div>
  );
}

export default function Diagnostics() {
  const [token, setToken] = useState<string | null>(null);
  const jwt = useMemo(() => decodeJwtPayload(token), [token]);
  const [health, setHealth] = useState<CheckResult>();
  const [pubcfg, setPubcfg] = useState<CheckResult>();
  const [profile, setProfile] = useState<CheckResult>();
  const [payCfg, setPayCfg] = useState<CheckResult>();
  const [order, setOrder] = useState<CheckResult>();
  const [preflight, setPreflight] = useState<CheckResult>();

  useEffect(() => {
    // read token
    setToken(readToken());

    // CORS preflight hint (OPTIONS /api/health)
    getJSON(`${API_BASE}/api/health`, { method: "OPTIONS" }).then(setPreflight);

    // health
    getJSON(`${API_BASE}/api/health`).then(setHealth);

    // public-config
    getJSON(`${API_BASE}/api/public-config`).then(setPubcfg);

    // profile (with token if present)
    const t = readToken();
    if (t) {
      getJSON(`${API_BASE}/api/profile`, {
        headers: { Authorization: `Bearer ${t}` },
      }).then(setProfile);
    } else {
      setProfile({ ok: false, error: "no token present" });
    }

    // payments config
    getJSON(`${API_BASE}/api/payments/config`).then(setPayCfg);
  }, []);

  const jwtInfo = useMemo(() => {
    if (!jwt) return null;
    const exp = jwt.exp ? new Date(jwt.exp * 1000) : null;
    const iat = jwt.iat ? new Date(jwt.iat * 1000) : null;
    const now = new Date();
    const expired = exp ? exp.getTime() < now.getTime() : null;
    return { exp: exp?.toISOString(), iat: iat?.toISOString(), expired };
  }, [jwt]);

  async function runCreateOrder(force?: "IN" | "INTL") {
    setOrder(undefined);
    const t = readToken();
    if (!t) {
      setOrder({ ok: false, error: "no token present (login first)" });
      return;
    }
    const url = new URL(`${API_BASE}/api/payments/create-order`);
    if (force) url.searchParams.set("force", force);
    const res = await getJSON(url.toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
    });
    setOrder(res);
  }

  function CopyBtn({ text }: { text: string }) {
    return (
      <button
        onClick={() => navigator.clipboard.writeText(text)}
        style={{
          border: "1px solid #2b3650",
          background: "transparent",
          color: "#93c5fd",
          padding: "4px 8px",
          borderRadius: 8,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Copy
      </button>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", color: "#e5e7eb", background: "#0b0f1a", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Diagnostics</h1>

      <section
        style={{
          marginBottom: 14,
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <div style={{ border: "1px solid #243044", borderRadius: 12, padding: 14, background: "#0e1320" }}>
          <div style={{ fontWeight: 800 }}>Environment</div>
          <div style={{ opacity: 0.85, fontSize: 13, marginTop: 8 }}>
            <div>
              <b>NEXT_PUBLIC_API_BASE:</b> {API_BASE}{" "}
              <CopyBtn text={API_BASE} />
            </div>
            <div>
              <b>User Agent:</b> <span style={{ opacity: 0.85 }}>{typeof navigator !== "undefined" ? navigator.userAgent : "(server)"}</span>
            </div>
            <div>
              <b>Timezone:</b> {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </div>
          </div>
        </div>

        <div style={{ border: "1px solid #243044", borderRadius: 12, padding: 14, background: "#0e1320" }}>
          <div style={{ fontWeight: 800 }}>Auth token</div>
          <div style={{ opacity: 0.85, fontSize: 13, marginTop: 8 }}>
            <div><b>Present:</b> {token ? "yes" : "no"}</div>
            {jwtInfo ? (
              <>
                <div><b>Expires:</b> {jwtInfo.exp || "(n/a)"}</div>
                <div><b>Issued:</b> {jwtInfo.iat || "(n/a)"} </div>
                <div><b>Expired now?:</b> {jwtInfo.expired === null ? "(unknown)" : jwtInfo.expired ? "yes" : "no"}</div>
                <details style={{ marginTop: 6 }}>
                  <summary>JWT payload</summary>
                  <pre style={{ whiteSpace: "pre-wrap", background: "#0d1220", border: "1px solid #23304a", borderRadius: 8, padding: 10 }}>
                    {toJSON(jwt)}
                  </pre>
                </details>
              </>
            ) : (
              <div style={{ opacity: 0.75 }}>No JWT payload decoded.</div>
            )}
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <Row title="CORS preflight (OPTIONS /api/health)" result={preflight} description="Checks if your origin is allowed by the backend. If FAIL/WARN, fix CORS on FastAPI. " />
        <Row title="GET /api/health" result={health} />
        <Row title="GET /api/public-config" result={pubcfg}>
          {pubcfg?.ok && pubcfg.data ? (
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              <b>Region:</b> {pubcfg.data.region} · <b>Currency:</b> {pubcfg.data.currency} ·{" "}
              <b>Pro:</b> {pubcfg.data.plans?.pro?.price}/{pubcfg.data.plans?.pro?.period}
            </div>
          ) : null}
        </Row>
        <Row title="GET /api/profile (Bearer token)" result={profile} description="401 → login again. 403/404/500 → server route/security. Network/CORS → check backend ALLOWED_ORIGINS." />
        <Row title="GET /api/payments/config" result={payCfg} />
        <Row title="POST /api/payments/create-order" result={order} description="Creates a Razorpay order (test mode shows amount/currency).">
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" style={{ border: "1px solid #2b3650", background: "#0f172a", color: "#93c5fd", padding: "6px 10px", borderRadius: 8, cursor: "pointer" }} onClick={() => runCreateOrder()}>
              Create (auto region)
            </button>
            <button className="btn" style={{ border: "1px solid #2b3650", background: "#0f172a", color: "#93c5fd", padding: "6px 10px", borderRadius: 8, cursor: "pointer" }} onClick={() => runCreateOrder("IN")}>
              Create (force=IN)
            </button>
            <button className="btn" style={{ border: "1px solid #2b3650", background: "#0f172a", color: "#93c5fd", padding: "6px 10px", borderRadius: 8, cursor: "pointer" }} onClick={() => runCreateOrder("INTL")}>
              Create (force=INTL)
            </button>
          </div>
        </Row>
      </section>

      <p style={{ marginTop: 18, opacity: 0.7, fontSize: 12 }}>
        Tip: If <code>create-order</code> returns amount <b>49900</b> instead of <b>199900</b>, your backend pricing isn’t reading the new value from <code>/api/public-config</code>.
      </p>
    </main>
  );
}
