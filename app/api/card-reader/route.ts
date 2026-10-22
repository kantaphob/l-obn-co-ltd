import { NextRequest, NextResponse } from "next/server";
import { getSessionFromToken, sessionCookie } from "../../../lib/auth";
import { readThaiIdCard } from "../../../lib/thai-id-card";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  if (!(await getSessionFromToken(request.cookies.get(sessionCookie.name)?.value))) {
    return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  }
  try {
    const card = await readThaiIdCard();
    return NextResponse.json({ card, reader: "ACS ACR39U" }, { headers: noStore });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "อ่านบัตรไม่สำเร็จ" }, { status: 503, headers: noStore });
  }
}
