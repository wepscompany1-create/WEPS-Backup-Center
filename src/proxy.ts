import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { getEnv } from "@/lib/config/env";
import { createPublicUrl } from "@/lib/security/redirect";
import { applySecurityHeaders } from "@/lib/security/headers";

const { auth } = NextAuth(authConfig);

const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/health"];

export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isLoggedIn = Boolean(request.auth?.user?.id);
  const appOrigin = getEnv().appUrl || undefined;

  if (pathname.startsWith("/api/health")) {
    return applySecurityHeaders(NextResponse.next());
  }

  if (pathname === "/login") {
    if (isLoggedIn) {
      return applySecurityHeaders(
        NextResponse.redirect(createPublicUrl("/", appOrigin, request.nextUrl.origin)),
      );
    }
    return applySecurityHeaders(NextResponse.next());
  }

  if (!isLoggedIn && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return applySecurityHeaders(
        NextResponse.json({ error: "غير مصرح", code: "UNAUTHORIZED" }, { status: 401 }),
      );
    }
    const loginUrl = createPublicUrl("/login", appOrigin, request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return applySecurityHeaders(NextResponse.next());
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
