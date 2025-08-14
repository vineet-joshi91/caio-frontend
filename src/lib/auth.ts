// src/lib/auth.ts
// Production-safe helpers for auth storage + retrieval.
// Uses both cookie (for middleware/SSR) and localStorage (client convenience).

export function setAuthToken(token: string) {
  try {
    localStorage.setItem("token", token);
  } catch {}
  // 1 day; adjust as you like
  document.cookie = `token=${encodeURIComponent(token)}; Path=/; Max-Age=86400; SameSite=Lax`;
}

export function getAuthToken(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch {}
  try {
    return localStorage.getItem("token");
  } catch {}
  return null;
}

export function clearAuthToken() {
  try {
    localStorage.removeItem("token");
  } catch {}
  // expire the cookie
  document.cookie = `token=; Path=/; Max-Age=0; SameSite=Lax`;
}
