import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { hashPassword, verifyPassword } from "../../../../lib/password";
import { hashSessionToken } from "../../../../lib/auth";
import { createSessionToken, sessionCookie, verifySessionToken } from "../../../../lib/session-token";

export async function POST(request: Request) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    return NextResponse.json({ message: "ระบบยังตั้งค่า SESSION_SECRET ไม่ครบ" }, { status: 503 });
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const user = username
    ? await prisma.user.findUnique({
      where: { username },
      include: { role: { include: { permissions: { select: { permission: true } } } } },
    })
    : null;
  if (!user || !(await verifyPassword(password, user.password))) {
    return NextResponse.json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
  const isFullAdmin = user.role.code === "ADMIN" && user.role.permissions.some(({ permission }) => permission === "*");
  if (!isFullAdmin) return NextResponse.json({ message: "บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบ" }, { status: 403 });

  const token = await createSessionToken({ userId: user.id, username: user.username, roleCode: user.role.code });
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ message: "สร้างเซสชันไม่สำเร็จ" }, { status: 500 });
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(payload.expiresAt * 1000),
    },
  });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie.name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionCookie.maxAge,
  });
  return response;
}
