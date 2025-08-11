"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Full signup page wired to your FastAPI backend.
 * Your backend endpoint expects email & password as QUERY params,
 * so we send them in the URL, not as JSON.
 *
 * Make sure NEXT_PUBLIC_API_BASE is set (e.g. https://caio-backend.onrender.com)
 */
export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_BASE || "";

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      // Your FastAPI route:
      // @app.post("/api/signup")
      // def signup(email: str, password: str, ...)
      //
      // Because the backend parameters are plain `str` (not Form/Body),
      // FastAPI reads them from the QUERY STRING.
      const url = `${API}/api/signup?email=${encodeURIComponent(
        email.trim()
      )}&password=${encodeURIComponent(password.trim())}`;

      const res = await fetch(url, { method: "POST" });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err.detail || "Signup failed. Try a different email.");
        setLoading(false);
        return;
      }

      // If we get here, it worked
      setMessage("Signup successful! You can now log in.");
      // small pause so user sees the message, then go to login
      setTimeout(() => router.push("/"), 1200);
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
      <h1
        style={{
          textAlign: "center",
          fontSize: "2.1em",
          letterSpacing: "1.2px",
          color: "#154272",
          marginBottom: 7,
        }}
      >
        Sign Up
      </h1>
      <div
        style={{
          textAlign: "center",
          fontSize: "1.02em",
          color: "#375074",
          marginBottom: 23,
          letterSpacing: ".3px",
        }}
      >
        Create your CAIO account
      </div>

      <form onSubmit={handleSignup}>
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
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Choose a password"
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
          {loading ? "Creating account..." : "Sign Up"}
        </button>

        {message && (
          <div
            style={{
              marginTop: 18,
              color: message.toLowerCase().includes("failed") ? "crimson" : "#13706a",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {message}
          </div>
        )}
      </form>

      <div style={{ textAlign: "center", marginTop: 18 }}>
        Already have an account?{" "}
        <a href="/" style={{ color: "#154272", fontWeight: 600 }}>
          Go to Login
        </a>
      </div>
    </div>
  );
}
