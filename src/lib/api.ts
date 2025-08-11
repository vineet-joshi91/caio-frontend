// src/lib/api.ts
import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL;

if (!API) {
  // Helps catch misconfigured environments early
  // (won't break the build, but you'll see it at runtime)
  console.warn("NEXT_PUBLIC_API_URL is missing");
}

export type LoginResponse = {
  access_token: string;
  token_type: string;
};

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  // FastAPI's OAuth2PasswordRequestForm expects form-encoded with fields: username, password
  const res = await fetch(`${API}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || "Login failed");
  }
  return res.json();
}

export async function apiSignup(email: string, password: string): Promise<{ message: string }> {
  // Your FastAPI /api/signup expects simple function params (query args)
  const url = `${API}/api/signup?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const res = await fetch(url, { method: "POST" }); // body not required for these query params

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || "Signup failed");
  }
  return res.json();
}

export type Profile = {
  email: string;
  is_admin: boolean;
  is_paid: boolean;
  created_at: string;
};

export async function apiProfile(): Promise<Profile> {
  const token = getToken();
  const res = await fetch(`${API}/api/profile`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || "Profile fetch failed");
  }
  return res.json();
}

export type AdminStats = {
  users: number;
  paid_users: number;
  usage_logs: number;
  admin_email: string;
};

export async function apiAdmin(): Promise<AdminStats> {
  const token = getToken();
  const res = await fetch(`${API}/api/admin`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || "Admin fetch failed");
  }
  return res.json();
}
