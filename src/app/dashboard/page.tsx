"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

type Profile = {
  email: string;
  is_admin: boolean;
  is_paid: boolean;
  created_at?: string;
};

type Insights = {
  CFO?: string;
  COO?: string;
  CMO?: string;
  CHRO?: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [err, setErr] = useState<string>("");

  const [text, setText] = useState("");
  const [brains, setBrains] = useState<string[]>(["CFO", "COO", "CMO", "CHRO"]);

  const [analyzing, setAnalyzing] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [tokensUsed, setTokensUsed] = useState<number | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string>("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!API_BASE) {
      setErr(
        "NEXT_PUBLIC_API_BASE is not set. Create .env.local with NEXT_PUBLIC_API_BASE=https://caio-backend.onrender.com and restart."
      );
      setLoadingProfile(false);
      return;
    }
    if (!token) {
      router.push("/");
      return;
    }

    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
        });
        if (r.status === 401) {
          localStorage.removeItem("token");
          router.push("/");
          return;
        }
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || `Profile fetch failed (${r.status})`);
        }
        const p: Profile = await r.json();
        setProfile(p);
      } catch (e: any) {
        setErr(e?.message || "Failed to load profile.");
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [router]);

  const toggleBrain = (b: string) => {
    setBrains((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    );
  };

  const onAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzeError("");
    setInsights(null);
    setTokensUsed(null);

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    if (!text.trim()) {
      setAnalyzeError("Please paste some text to analyze.");
      return;
    }

    setAnalyzing(true);
    try {
      const r = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "omit",
        body: JSON.stringify({ text, brains }),
      });

      if (r.status === 401) {
        setAnalyzeError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        router.push("/");
        return;
      }
      if (r.status === 402) {
        setAnalyzeError(
          "Payment required for full analysis access. Ask admin to mark your account paid, or enable payments."
        );
        return;
      }
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `Analyze failed (${r.status})`);
      }

      const data = await r.json();
      setInsights(data.insights || null);
      setTokensUsed(typeof data.tokens_used === "number" ? data.tokens_used : null);
    } catch (e: any) {
      setAnalyzeError(e?.message || "Unexpected error while analyzing.");
    } finally {
      setAnalyzing(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    router.push("/");
  };

  const Box: React.FC<React.PropsWithChildren<{ title?: string }>> = ({
    title,
    children,
  }) => (
    <div
      style={{
        maxWidth: 980,
        margin: "28px auto",
        padding: 18,
        borderRadius: 10,
        background: "#fff",
        boxShadow: "0 0 18px #e9ecef",
      }}
    >
      {title && (
        <h2 style={{ marginTop: 0, marginBottom: 14, color: "#1b3554" }}>
          {title}
        </h2>
      )}
      {children}
    </div>
  );

  if (loadingProfile) return <Box title="Dashboard">Loading…</Box>;
  if (err)
    return (
      <Box title="Dashboard">
        <p style={{ color: "crimson", fontWeight: 700 }}>{err}</p>
        <Link href="/" style={btnSecondary}>
          Back to login
        </Link>
      </Box>
    );

  return (
    <Box title="Dashboard">
      {/* Header */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            Welcome, {profile?.email}
          </div>
          <div style={{ fontSize: 13, color: "#5a6b84" }}>
            {profile?.is_admin ? "Admin" : "User"} •{" "}
            {profile?.is_paid ? "Paid" : "Free"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {profile?.is_admin && (
            <Link href="/admin" style={btnLink}>
              Admin
            </Link>
          )}
          <button onClick={logout} style={btnPrimaryOutline}>
            Log out
          </button>
        </div>
      </div>

      {/* Analyze form */}
      <form onSubmit={onAnalyze}>
        <label style={{ fontWeight: 700 }}>Paste content to analyze</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a report, transcript, or notes…"
          rows={8}
          style={textarea}
        />

        <div style={{ margin: "10px 0 8px", fontWeight: 700 }}>Choose brains</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
          {["CFO", "COO", "CMO", "CHRO"].map((b) => (
            <label key={b} style={pill}>
              <input
                type="checkbox"
                checked={brains.includes(b)}
                onChange={() => toggleBrain(b)}
                style={{ marginRight: 8 }}
              />
              {b}
            </label>
          ))}
        </div>

        <button type="submit" style={btnPrimary} disabled={analyzing}>
          {analyzing ? "Analyzing…" : "Run analysis"}
        </button>

        {analyzeError && (
          <div style={{ color: "crimson", fontWeight: 700, marginTop: 10 }}>
            {analyzeError}
          </div>
        )}
      </form>

      {/* Results */}
      {insights && (
        <div style={{ marginTop: 18 }}>
          <h3 style={{ margin: "0 0 10px" }}>Insights</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {Object.entries(insights).map(([k, v]) => (
              <div key={k} style={card}>
                <div style={{ fontSize: 12, color: "#5a6b84", marginBottom: 6 }}>
                  {k}
                </div>
                <pre style={pre}>{v}</pre>
              </div>
            ))}
          </div>
          {typeof tokensUsed === "number" && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#5a6b84" }}>
              Tokens used (approx): <b>{tokensUsed}</b>
            </div>
          )}
        </div>
      )}
    </Box>
  );
}

/* ——— styles ——— */
const textarea: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d5dbe3",
  fontSize: 15,
  outline: "none",
  resize: "vertical",
  margin: "6px 0 12px",
};

const pill: React.CSSProperties = {
  border: "1px solid #d5dbe3",
  padding: "8px 12px",
  borderRadius: 999,
  userSelect: "none",
  display: "inline-flex",
  alignItems: "center",
  fontSize: 14,
  background: "#fff",
};

const card: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: "#f7f9fc",
  border: "1px solid #e6edf5",
};

const pre: React.CSSProperties = {
  margin: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontFamily: "inherit",
  fontSize: 14,
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 14px",
  background: "#154272",
  color: "#fff",
  borderRadius: 8,
  border: "none",
  fontWeight: 800,
  cursor: "pointer",
};

const btnPrimaryOutline: React.CSSProperties = {
  padding: "10px 14px",
  background: "#fff",
  color: "#154272",
  borderRadius: 8,
  border: "2px solid #154272",
  fontWeight: 800,
  cursor: "pointer",
};

const btnLink: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 14px",
  background: "#f1f5fb",
  color: "#154272",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 800,
};

const btnSecondary: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 14px",
  background: "#154272",
  color: "#fff",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 800,
};
