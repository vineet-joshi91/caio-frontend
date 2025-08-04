"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  // Demo login handler (replace with real API call when backend is ready)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    // TODO: Replace this block with a real backend API call for production!
    if (email === "admin@caio.ai" && password === "adminpass") {
      setMessage("Welcome, Admin! Redirecting...");
      // router.push("/admin");
    } else if (email === "demo@caio.ai" && password === "demopass") {
      setMessage("Welcome, Demo User! Redirecting...");
      // router.push("/dashboard");
    } else if (email === "full@caio.ai" && password === "fullpass") {
      setMessage("Welcome, Full User! Redirecting...");
      // router.push("/dashboard");
    } else {
      setMessage("Invalid email or password.");
    }
  };

  return (
    <div style={{
      maxWidth: 420,
      margin: "60px auto",
      background: "#fff",
      padding: 32,
      borderRadius: 10,
      boxShadow: "0 0 18px #e9ecef"
    }}>
      {/* Logo/Branding */}
      <h1 style={{
        textAlign: "center",
        fontSize: "2.1em",
        letterSpacing: "1.2px",
        color: "#154272",
        marginBottom: 7
      }}>
        CAIO
      </h1>
      <div style={{
        textAlign: "center",
        fontSize: "1.14em",
        color: "#375074",
        marginBottom: 23,
        letterSpacing: ".6px"
      }}>
        Your AI-Powered Chief Intelligence Officer
      </div>

      {/* Login Form */}
      <form onSubmit={handleLogin}>
        <label style={{fontWeight:600}}>Email</label>
        <input
          type="email"
          value={email}
          autoComplete="email"
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          style={{
            width: "100%", padding: "10px 8px", margin: "7px 0 14px 0",
            borderRadius: 4, border: "1px solid #d5dbe3", fontSize: "1.07em"
          }}
        />
        <label style={{fontWeight:600}}>Password</label>
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          required
          style={{
            width: "100%", padding: "10px 8px", margin: "7px 0 18px 0",
            borderRadius: 4, border: "1px solid #d5dbe3", fontSize: "1.07em"
          }}
        />
        <button
          type="submit"
          style={{
            width: "100%", padding: 13, background: "#154272",
            color: "#fff", border: "none", borderRadius: 4, fontWeight: 700,
            fontSize: "1.09em", letterSpacing: ".5px", marginTop: 6
          }}
        >
          Login
        </button>
        {message && (
          <div style={{
            marginTop: 18,
            color: message.startsWith("Invalid") ? "crimson" : "#13706a",
            fontWeight: 600,
            textAlign: "center"
          }}>
            {message}
          </div>
        )}
      </form>

      {/* Create Account Link */}
      <div style={{textAlign:"center",marginTop:18}}>
        <a href="/signup" style={{color:"#154272",fontWeight:600}}>Create an account</a>
      </div>
    </div>
  );
}
