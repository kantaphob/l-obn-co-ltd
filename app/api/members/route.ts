import { NextRequest, NextResponse } from "next/server";
import { getSessionFromToken, sessionCookie } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { nextRunningNumber } from "../../../lib/running-number";

const noStore = { "Cache-Control": "no-store" };
type MemberInput = {
  id?: unknown; employeeCode?: unknown; name?: unknown; nickname?: unknown; phone?: unknown;
  nationalId?: unknown; address?: unknown; dateOfBirth?: unknown; photoData?: unknown; team?: unknown;
};

function clean(value: unknown) { return typeof value === "string" ? value.trim() || null : null; }
function authorized(request: NextRequest) {
  return getSessionFromToken(request.cookies.get(sessionCookie.name)?.value);
}
function fullName(name: string, surname: string) { return [name, surname].filter(Boolean).join(" "); }
function splitName(value: string) {
  const [name, ...surname] = value.trim().split(/\s+/);
  return { name, surname: surname.join(" ") || "-" };
}
function formatMember(member: {
  id: number; borrowerNo: string | null; name: string; surname: string; nickname: string | null;
  phone: string | null; nationalId: string | null; address: string | null; birthDate: Date | null;
  photoData: string | null; departmentName: string | null;
}) {
  return {
    id: String(member.id), employeeCode: member.borrowerNo, name: fullName(member.name, member.surname),
    nickname: member.nickname, phone: member.phone, nationalId: member.nationalId, address: member.address,
    dateOfBirth: member.birthDate?.toISOString().slice(0, 10) ?? null, photoData: member.photoData,
    team: member.departmentName,
  };
}
function validPhoto(value: string | null) {
  return !value || (value.length <= 100_000 && /^[A-Za-z0-9+/]+={0,2}$/.test(value));
}
function parseBirthDate(value: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? undefined : date;
}
function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
const memberSelect = {
  id: true, borrowerNo: true, name: true, surname: true, nickname: true, phone: true,
  nationalId: true, address: true, birthDate: true, photoData: true, departmentName: true,
} as const;

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  try {
    const members = await prisma.borrowerProfile.findMany({ where: { status: "ACTIVE" }, select: memberSelect, orderBy: [{ name: "asc" }, { surname: "asc" }] });
    return NextResponse.json({ members: members.map(formatMember) }, { headers: noStore });
  } catch {
    return NextResponse.json({ message: "อ่านข้อมูลสมาชิกไม่สำเร็จ" }, { status: 500, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: MemberInput;
  try { body = await request.json() as MemberInput; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const nameValue = clean(body.name);
  const nationalId = clean(body.nationalId);
  const photoData = clean(body.photoData);
  const birthDate = parseBirthDate(clean(body.dateOfBirth));
  if (!nameValue) return NextResponse.json({ message: "กรุณาระบุชื่อสมาชิก" }, { status: 400, headers: noStore });
  if (nationalId && !/^\d{13}$/.test(nationalId)) return NextResponse.json({ message: "เลขประจำตัวประชาชนต้องมี 13 หลัก" }, { status: 400, headers: noStore });
  if (!validPhoto(photoData)) return NextResponse.json({ message: "รูปถ่ายจากบัตรไม่ถูกต้อง" }, { status: 400, headers: noStore });
  if (birthDate === undefined) return NextResponse.json({ message: "วันเกิดต้องอยู่ในรูปแบบ YYYY-MM-DD" }, { status: 400, headers: noStore });
  const names = splitName(nameValue);
  try {
    const borrowerNo = clean(body.employeeCode) ?? await nextRunningNumber({ scope: "org_lobn", series: "MEMBER", prefix: "MB", width: 6 });
    const member = await prisma.borrowerProfile.create({
      data: {
        borrowerNo, nationalId, name: names.name, surname: names.surname, nickname: clean(body.nickname),
        phone: clean(body.phone), address: clean(body.address), birthDate, photoData,
        departmentName: clean(body.team), status: "ACTIVE",
      },
      select: memberSelect,
    });
    return NextResponse.json({ member: formatMember(member) }, { status: 201, headers: noStore });
  } catch (error) {
    return NextResponse.json({ message: isUniqueConstraintError(error) ? "รหัสสมาชิกหรือเลขบัตรนี้ถูกใช้แล้ว" : "บันทึกสมาชิกไม่สำเร็จ" }, { status: isUniqueConstraintError(error) ? 409 : 500, headers: noStore });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: MemberInput;
  try { body = await request.json() as MemberInput; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const id = Number(body.id);
  const nameValue = clean(body.name);
  const nationalId = clean(body.nationalId);
  const photoData = clean(body.photoData);
  const birthDate = parseBirthDate(clean(body.dateOfBirth));
  if (!Number.isInteger(id) || id < 1 || !nameValue) return NextResponse.json({ message: "กรุณาระบุสมาชิกและชื่อให้ถูกต้อง" }, { status: 400, headers: noStore });
  if (nationalId && !/^\d{13}$/.test(nationalId)) return NextResponse.json({ message: "เลขประจำตัวประชาชนต้องมี 13 หลัก" }, { status: 400, headers: noStore });
  if (!validPhoto(photoData)) return NextResponse.json({ message: "รูปถ่ายจากบัตรไม่ถูกต้อง" }, { status: 400, headers: noStore });
  if (birthDate === undefined) return NextResponse.json({ message: "วันเกิดต้องอยู่ในรูปแบบ YYYY-MM-DD" }, { status: 400, headers: noStore });
  const names = splitName(nameValue);
  try {
    const member = await prisma.borrowerProfile.update({
      where: { id },
      data: {
        borrowerNo: clean(body.employeeCode), name: names.name, surname: names.surname,
        nickname: clean(body.nickname), phone: clean(body.phone), nationalId,
        address: clean(body.address), birthDate, photoData, departmentName: clean(body.team),
      },
      select: memberSelect,
    });
    return NextResponse.json({ member: formatMember(member) }, { headers: noStore });
  } catch (error) {
    const missing = typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
    return NextResponse.json({ message: missing ? "ไม่พบสมาชิก" : isUniqueConstraintError(error) ? "รหัสสมาชิกหรือเลขบัตรนี้ถูกใช้แล้ว" : "แก้ไขสมาชิกไม่สำเร็จ" }, { status: missing ? 404 : isUniqueConstraintError(error) ? 409 : 500, headers: noStore });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: { id?: unknown };
  try { body = await request.json() as { id?: unknown }; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ message: "ไม่พบรหัสสมาชิก" }, { status: 400, headers: noStore });
  try {
    const result = await prisma.borrowerProfile.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "INACTIVE" } });
    if (!result.count) return NextResponse.json({ message: "ไม่พบสมาชิก" }, { status: 404, headers: noStore });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return NextResponse.json({ message: "นำสมาชิกออกไม่สำเร็จ" }, { status: 500, headers: noStore });
  }
}
