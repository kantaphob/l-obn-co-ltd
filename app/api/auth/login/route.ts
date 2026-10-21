import { NextResponse } from "next/server";
import { constantTimeEqual, createSessionToken, getAdminCredentials, sessionCookie } from "../../../../lib/auth";

export async function POST(request: Request) {
  const credentials = getAdminCredentials();
  if (!credentials || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    return NextResponse.json({ message: "ระบบยังตั้งค่าไม่ครบ กรุณากำหนดข้อมูลผู้ดูแลในไฟล์ .env.local" }, { status: 503 });
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!constantTimeEqual(username, credentials.username) || !constantTimeEqual(password, credentials.password)) {
    return NextResponse.json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie.name, await createSessionToken(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionCookie.maxAge,
  });
  return response;
}
