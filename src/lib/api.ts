// src/lib/api.ts
import axios from "axios";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://caio-backend.onrender.com";

export interface LoginResult {
  access_token: string;
  token_type: "bearer";
}

export interface Profile {
  email: string;
  is_admin: boolean;
  is_paid: boolean;
  created_at: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  // FastAPI OAuth2PasswordRequestForm expects "username" and "password"
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);

  const { data } = await axios.post<LoginResult>(`${API_BASE}/api/login`, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data;
}

export async function getProfile(token: string): Promise<Profile> {
  const { data } = await axios.get<Profile>(`${API_BASE}/api/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}
