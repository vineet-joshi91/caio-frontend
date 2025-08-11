"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Full login page wired to your FastAPI backend.
 * Expects NEXT_PUBLIC_API_BASE to be set (e.g. https://caio-backend.onrender.com)
 */
export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_BASE || "";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      // FastAPI /api/login expects form-encoded fields: username + password
      const res = await fetch(`${API}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: email.trim(),
          password: password.trim(),
        }),
      });

      if (!res.ok) {
        // Try to read FastAPI error body; fall back to generic text
        const err = await res.json().catch(() => ({}));
        setMessage(err.detail || "Invalid email or password.");
        setLoading(false);
        return;
      }

      const data: { access_token: string; token_type: string } = await res.json();
      localStorage.setItem("token", data.access_token);

      // Optional: fetch profile so we know where to send the user
      let nextPath = "/dashboard";
      try {
        const profRes = await fetch(`${API}/api/profile`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (profRes.ok) {
          const prof = await profRes.json();
          if (prof?.is_admin) nextPath = "/admin";
        }
      } catch {
        // ignore profile errors; fall back to dashboard
      }

      setMessage("Welcome! Redirecting...");
      router.push(nextPath);
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "60px auto",
        background: "#fff",
        padding: 32,
        borderRadius: 10,
        boxShadow: "0 0 18px #e9ecef",
      }}
    >
      {/* Logo/Branding */}
      <h1
        style={{
          textAlign: "center",
          fontSize: "2.1em",
          letterSpacing: "1.2px",
          color: "#154272",
          marginBottom: 7,
        }}
      >
        CAIO
      </h1>
      <div
        style={{
          textAlign: "center",
          fontSize: "1.14em",
          color: "#375074",
          marginBottom: 23,
          letterSpacing: ".6px",
        }}
      >
        Your AI-Powered Chief Intelligence Officer
      </div>

      {/* Login Form */}
      <form onSubmit={handleLogin}>
        <label style={{ fontWeight: 600 }}>Email</label>
        <input
          type="email"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          style={{
            width: "100%",
            padding: "10px 8px",
            margin: "7px 0 14px 0",
            borderRadius: 4,
            border: "1px solid #d5dbe3",
            fontSize: "1.07em",
          }}
        />

        <label style={{ fontWeight: 600 }}>Password</label>
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          style={{
            width: "100%",
            padding: "10px 8px",
            margin: "7px 0 18px 0",
            borderRadius: 4,
            border: "1px solid #d5dbe3",
            fontSize: "1.07em",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 13,
            background: loading ? "#6c87a3" : "#154272",
            cursor: loading ? "not-allowed" : "pointer",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            fontWeight: 700,
            fontSize: "1.09em",
            letterSpacing: ".5px",
            marginTop: 6,
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {message && (
          <div
            style={{
              marginTop: 18,
              color: message.toLowerCase().includes("invalid") ? "crimson" : "#13706a",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {message}
          </div>
        )}
      </form>

      {/* Create Account Link */}
      <div style={{ textAlign: "center", marginTop: 18 }}>
        <a href="/signup" style={{ color: "#154272", fontWeight: 600 }}>
          Create an account
        </a>
      </div>
    </div>
  );
}
