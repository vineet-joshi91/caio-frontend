// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Purpose:
 * - Protect ONLY /premium/* and /admin/*.
 * - NEVER interfere with Next.js internals (/ _next /) or static files.
 *
 * Notes:
 * - Middleware can only read cookies, not localStorage.
 * - We keep the cookie name as "token" (same as your current code).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow Next.js internals & common static files
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // Only protect premium/admin routes (matcher already enforces this,
  // but we keep the guard for safety in case matcher changes later)
  const isProtected =
    pathname.startsWith("/premium") || pathname.startsWith("/admin");

  if (!isProtected) {
    return NextResponse.next();
  }

  // Auth check (cookie only)
  const token = req.cookies.get("token")?.value;
  if (!token) {
    // unauthenticated → redirect to login
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

// Protect ONLY premium/admin, and explicitly exclude Next.js internals.
export const config = {
  matcher: [
    "/premium/:path*",
    "/admin/:path*",
  ],
};
