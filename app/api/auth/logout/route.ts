import { NextRequest, NextResponse } from "next/server";
import { revokeSession, sessionCookie } from "../../../../lib/auth";

export async function POST(request: NextRequest) {
  await revokeSession(request.cookies.get(sessionCookie.name)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie.name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
