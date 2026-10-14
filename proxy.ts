import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionCookie } from "@/lib/auth/session";

const SESSION_COOKIE_NAME = "admin_session";

// Optimistic check only (cookie signature, not a DB lookup) — every admin
// Server Action still calls verifySession() itself as the real gate.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const isValid = await verifySessionCookie(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (pathname === "/admin/login") {
    if (isValid) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (!isValid) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
