import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Coarse, cookie-only gate for fast redirects. It is NOT the security boundary:
// every page, server action and route handler re-checks the user and role against
// the database via src/lib/authz.ts.
const { auth } = NextAuth(authConfig);

const PUBLIC_PREFIXES = ["/login", "/set-password", "/api/auth"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const role = req.auth?.user?.role;
  if (!role) {
    const url = new URL("/login", req.nextUrl);
    if (pathname !== "/") url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/employee", req.nextUrl));
  }
  if (pathname.startsWith("/employee") && role !== "EMPLOYEE") {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)"],
};
