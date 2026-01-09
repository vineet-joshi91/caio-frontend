// app/api/logout/route.ts
import { NextResponse } from "next/server";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.trim().replace(/\/+$/, "")) ||
  "http://localhost:8000";

export async function POST() {
  // best effort call to backend to clear its cookie (if any)
  try {
    await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "include" });
  } catch {
    // ignore network errors, still clear local cookie below
  }

  // clear the token cookie on the frontend domain
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: "token",
    value: "",
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: false, // must match how you set it
    secure: true,    // keep true in prod (https)
  });
  return res;
}
