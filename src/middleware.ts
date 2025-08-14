// src/middleware.ts

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value || "";
  const { pathname } = req.nextUrl;

  const protectedRoutes = ["/dashboard", "/admin"];
  const needsAuth = protectedRoutes.some((p) => pathname.startsWith(p));

  // if protected and no token -> go home
  if (needsAuth && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // if token exists and user hits "/" or "/signup" -> go to dashboard
  if ((pathname === "/" || pathname === "/signup") && token) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/signup", "/dashboard/:path*", "/admin/:path*"],
};
