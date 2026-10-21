import { NextRequest, NextResponse } from "next/server";
import { isValidSessionToken, sessionCookie } from "./lib/auth";

export async function proxy(request: NextRequest) {
  const authenticated = await isValidSessionToken(request.cookies.get(sessionCookie.name)?.value);
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
  matcher: ["/", "/login"],
};
