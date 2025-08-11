"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type AdminStats = {
  users: number;
  paid_users: number;
  usage_logs: number;
  admin_email: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function AdminPage() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "ok" | "unauthorized" | "forbidden" | "error"
  >("idle");
  const [message, setMessage] = useState<string>("");
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    if (!API_BASE) {
      setStatus("error");
      setMessage(
        "NEXT_PUBLIC_API_BASE is not set. Create .env.local in /frontend with NEXT_PUBLIC_API_BASE=https://caio-backend.onrender.com and restart."
      );
      return;
    }

    if (!token) {
      setStatus("unauthorized");
      setMessage("No login session found. Please log in again.");
      return;
    }

    setStatus("loading");

    // 1) Fetch profile to confirm token works and see is_admin
    fetch(`${API_BASE}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "omit",
    })
      .then(async (r) => {
        if (r.ok) return r.json();
        if (r.status === 401) {
          setStatus("unauthorized");
          setMessage("Session expired or invalid. Please log in again.");
          throw new Error("401");
        }
        const text = await r.text();
        throw new Error(text || `Profile error: ${r.status}`);
      })
      .then((p) => {
        setProfile(p);
        // 2) Try admin endpoint
        return fetch(`${API_BASE}/api/admin`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        });
      })
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json();
          setStats(data);
          setStatus("ok");
          return;
        }
        if (r.status === 403) {
          setStatus("forbidden");
          setMessage("Your account isn’t marked as admin on the backend.");
          return;
        }
        if (r.status === 401) {
          setStatus("unauthorized");
          setMessage("Session expired or invalid. Please log in again.");
          return;
        }
        const text = await r.text();
        setStatus("error");
        setMessage(text || `Admin fetch failed (${r.status}).`);
      })
      .catch((err) => {
        if (status === "idle" || status === "loading") {
          setStatus("error");
          setMessage(err?.message || "Unexpected error");
        }
      });
  }, []);

  const Box: React.FC<React.PropsWithChildren<{ title?: string }>> = ({ title, children }) => (
    <div
      style={{
        maxWidth: 780,
        margin: "28px auto",
        padding: 18,
        borderRadius: 10,
        background: "#fff",
        boxShadow: "0 0 18px #e9ecef",
      }}
    >
      {title && <h2 style={{ marginTop: 0 }}>{title}</h2>}
      {children}
    </div>
  );

  if (status === "loading" || status === "idle") {
    return <Box title="Admin">Loading…</Box>;
  }

  if (status === "unauthorized") {
    return (
      <Box title="Admin">
        <p style={{ color: "crimson", fontWeight: 700 }}>{message}</p>
        <Link href="/" style={linkBtn}>
          Back to login
        </Link>
      </Box>
    );
  }

  if (status === "forbidden") {
    return (
      <Box title="Admin access required">
        <p style={{ color: "crimson", fontWeight: 700, marginBottom: 12 }}>
          {message}
        </p>

        {profile && (
          <div style={{ marginBottom: 16 }}>
            <div><b>Email:</b> {profile.email}</div>
            <div><b>is_admin:</b> {String(profile.is_admin)}</div>
            <div><b>is_paid:</b> {String(profile.is_paid)}</div>
          </div>
        )}

        <ol style={{ lineHeight: 1.6, marginTop: 10 }}>
          <li>
            In Render &rarr; <b>caio-backend</b> &rarr; <b>Environment</b>, set
            <code> ADMIN_EMAIL </code> to your admin email
            (e.g. <code>vineetpjoshi.71@gmail.com</code>) and redeploy.
          </li>
          <li>
            If this account was created earlier without admin, either delete that user
            from the DB and sign up again, or update the row to <code>is_admin=true</code>.
            Easiest path: delete the user and sign up again.
          </li>
          <li>
            Log out (clear token) and log in again, then come back to <code>/admin</code>.
          </li>
        </ol>

        <div style={{ marginTop: 12 }}>
          <Link href="/" style={linkBtn}>
            Back to login
          </Link>
        </div>
      </Box>
    );
  }

  if (status === "error") {
    return (
      <Box title="Admin">
        <p style={{ color: "crimson", fontWeight: 700, marginBottom: 12 }}>
          {message || "Admin fetch failed"}
        </p>
        <Link href="/" style={linkBtn}>
          Back to login
        </Link>
      </Box>
    );
  }

  // OK: show admin stats
  return (
    <Box title="Admin dashboard">
      {profile && (
        <div style={{ marginBottom: 16 }}>
          <div><b>Logged in as:</b> {profile.email}</div>
          <div><b>Admin:</b> {String(profile.is_admin)}</div>
        </div>
      )}

      {stats ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 14,
          }}
        >
          <Stat label="Users" value={stats.users} />
          <Stat label="Paid users" value={stats.paid_users} />
          <Stat label="Usage logs" value={stats.usage_logs} />
          <Stat label="Admin email (server)" value={stats.admin_email} />
        </div>
      ) : (
        <p>No stats found.</p>
      )}

      <div style={{ marginTop: 16 }}>
        <Link href="/" style={linkBtn}>
          Log out
        </Link>
      </div>
    </Box>
  );
}

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div style={{ padding: 14, borderRadius: 8, background: "#f7f9fc", border: "1px solid #e6edf5" }}>
    <div style={{ fontSize: 12, color: "#5a6b84", marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
  </div>
);

const linkBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 14px",
  background: "#154272",
  color: "#fff",
  borderRadius: 6,
  textDecoration: "none",
  fontWeight: 700,
};
