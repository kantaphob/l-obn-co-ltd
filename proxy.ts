import { NextRequest, NextResponse } from "next/server";
import { sessionCookie, verifySessionToken } from "./lib/session-token";

export async function proxy(request: NextRequest) {
  const authenticated = Boolean(await verifySessionToken(request.cookies.get(sessionCookie.name)?.value));
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (!authenticated && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (authenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
