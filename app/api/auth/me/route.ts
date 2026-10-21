import { NextRequest, NextResponse } from "next/server";
import { getSessionFromToken, sessionCookie } from "../../../../lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSessionFromToken(request.cookies.get(sessionCookie.name)?.value);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ user: session }, { headers: { "Cache-Control": "no-store" } });
}
