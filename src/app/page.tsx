"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Works with either var name; falls back to your Render URL
  const API =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "https://caio-backend.onrender.com";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: email.trim(),   // FastAPI OAuth2 expects "username"
          password: password.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err.detail || "Invalid email or password.");
        return;
      }

      const data = (await res.json()) as { access_token: string; token_type: string };
      localStorage.setItem("token", data.access_token);

      // Optional: route admins differently
      let next = "/dashboard";
      try {
        const prof = await fetch(`${API}/api/profile`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (prof.ok) {
          const j = await prof.json();
          if (j?.is_admin) next = "/admin";
        }
      } catch {}

      setMessage("Welcome! Redirecting...");
      router.push(next);
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ... keep your JSX exactly as you have it
}
