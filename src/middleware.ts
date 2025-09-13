// middleware.ts (or src/middleware.ts)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value; // server can only see cookies
  if (!token) {
    // unauthenticated → send to login (NOT to "/")
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Only protect premium/admin, NOT /dashboard or /
export const config = {
  matcher: ["/premium/:path*", "/admin/:path*"],
};
