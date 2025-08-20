// src/app/logout-bridge/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function GET(req: NextRequest) {
  // Redirect to /signup on the same Vercel origin
  const url = new URL("/signup", req.url);
  const res = NextResponse.redirect(url);

  // Delete the auth cookie on this domain
  res.cookies.set({
    name: "token",
    value: "",
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });

  return res;
}
