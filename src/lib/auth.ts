// src/lib/auth.ts
export function getApiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_BASE || "";
  return env.replace(/\/+$/, "");
}

export function saveToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("access_token", token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
}

export async function fetchWithAuth(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers: HeadersInit = {
    ...(init.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const api = getApiBase();
  return fetch(`${api}${path}`, { ...init, headers, credentials: "include" });
}

export type Tier = "admin" | "premium" | "pro_plus" | "pro" | "demo";

export function routeForTier(tier?: Tier): string {
  if (!tier) return "/dashboard";
  if (tier === "admin" || tier === "premium" || tier === "pro_plus") return "/premium/chat";
  return "/dashboard";
}
