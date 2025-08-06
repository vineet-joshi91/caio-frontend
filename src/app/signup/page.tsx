"use client";
import React, { useState } from "react";
import Link from "next/link";

const SignupPage = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setSuccess("Signup successful! You can now log in.");
      setForm({ email: "", password: "" });
    } catch {
      setError("Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <h1>Sign Up</h1>
      <form onSubmit={handleSubmit} autoComplete="off">
        <div>
          <label>Email:</label>
          <input
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange}
            disabled={loading}
            autoComplete="new-email"
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            name="password"
            type="password"
            required
            value={form.password}
            onChange={handleChange}
            disabled={loading}
            autoComplete="new-password"
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Signing up..." : "Sign Up"}
        </button>
      </form>
      {success && <p style={{ color: "green" }}>{success}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      <p>
        Already have an account?{" "}
        <Link href="/">Go to Home</Link>
      </p>
    </div>
  );
};

export default SignupPage;
