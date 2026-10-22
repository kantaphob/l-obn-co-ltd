import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "../../../generated/prisma/client";
import { getSessionFromToken, sessionCookie } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

const organizationId = "org_lobn";
const noStore = { "Cache-Control": "no-store" };

type MemberInput = {
  id?: unknown;
  employeeCode?: unknown;
  name?: unknown;
  nickname?: unknown;
  phone?: unknown;
  nationalId?: unknown;
  address?: unknown;
  dateOfBirth?: unknown;
  photoData?: unknown;
  team?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function authorized(request: NextRequest) {
  return Boolean(await getSessionFromToken(request.cookies.get(sessionCookie.name)?.value));
}

async function findOrCreateDepartment(team: string | null, transaction: Prisma.TransactionClient) {
  if (!team) return null;
  return transaction.department.upsert({
    where: { organizationId_name: { organizationId, name: team } },
    update: {},
    create: { organizationId, name: team },
    select: { id: true },
  });
}

function memberSelect() {
  return {
    id: true,
    employeeCode: true,
    fullName: true,
    nickname: true,
    phone: true,
    nationalId: true,
    address: true,
    dateOfBirth: true,
    photoData: true,
    department: { select: { name: true } },
  } as const;
}

type MemberResult = {
  id: string;
  employeeCode: string | null;
  fullName: string;
  nickname: string | null;
  phone: string | null;
  nationalId: string | null;
  address: string | null;
  dateOfBirth: string | null;
  photoData: string | null;
  department: { name: string } | null;
};

function formatMember(member: MemberResult | null) {
  if (!member) return null;
  return {
    id: member.id,
    employeeCode: member.employeeCode,
    name: member.fullName,
    nickname: member.nickname,
    phone: member.phone,
    nationalId: member.nationalId,
    address: member.address,
    dateOfBirth: member.dateOfBirth,
    photoData: member.photoData,
    team: member.department?.name ?? null,
  };
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  const members = await prisma.member.findMany({
    where: { organizationId, employmentStatus: "active" },
    select: memberSelect(),
    orderBy: { fullName: "asc" },
  });
  return NextResponse.json({ members: members.map(formatMember) }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: MemberInput;
  try { body = await request.json() as MemberInput; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const name = clean(body.name);
  if (!name) return NextResponse.json({ message: "กรุณาระบุชื่อสมาชิก" }, { status: 400, headers: noStore });

  const employeeCode = clean(body.employeeCode);
  const nationalId = clean(body.nationalId);
  const photoData = clean(body.photoData);
  if (nationalId && !/^\d{13}$/.test(nationalId)) return NextResponse.json({ message: "เลขประจำตัวประชาชนต้องมี 13 หลัก" }, { status: 400, headers: noStore });
  if (photoData && (photoData.length > 100_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(photoData))) return NextResponse.json({ message: "รูปถ่ายจากบัตรไม่ถูกต้อง" }, { status: 400, headers: noStore });
  if (nationalId && await prisma.member.findFirst({ where: { organizationId, nationalId, employmentStatus: "active" }, select: { id: true } })) {
    return NextResponse.json({ message: "เลขประจำตัวประชาชนนี้มีในทะเบียนผู้กู้แล้ว" }, { status: 409, headers: noStore });
  }
  try {
    const member = await prisma.$transaction(async (transaction) => {
      const department = await findOrCreateDepartment(clean(body.team), transaction);
      return transaction.member.create({
        data: {
          id: employeeCode ?? `MB-${randomUUID()}`,
          organizationId,
          departmentId: department?.id ?? null,
          employeeCode,
          fullName: name,
          nickname: clean(body.nickname),
          phone: clean(body.phone),
          nationalId,
          address: clean(body.address),
          dateOfBirth: clean(body.dateOfBirth),
          photoData,
        },
        select: memberSelect(),
      });
    });
    return NextResponse.json({ member: formatMember(member) }, { status: 201, headers: noStore });
  } catch (error) {
    return NextResponse.json(
      { message: isUniqueConstraintError(error) ? "รหัสสมาชิกนี้ถูกใช้แล้ว" : "บันทึกสมาชิกไม่สำเร็จ" },
      { status: isUniqueConstraintError(error) ? 409 : 500, headers: noStore },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: MemberInput;
  try { body = await request.json() as MemberInput; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const id = clean(body.id);
  const name = clean(body.name);
  if (!id || !name) return NextResponse.json({ message: "กรุณาระบุชื่อสมาชิก" }, { status: 400, headers: noStore });
  const nationalId = clean(body.nationalId);
  const photoData = clean(body.photoData);
  if (nationalId && !/^\d{13}$/.test(nationalId)) return NextResponse.json({ message: "เลขประจำตัวประชาชนต้องมี 13 หลัก" }, { status: 400, headers: noStore });
  if (photoData && (photoData.length > 100_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(photoData))) return NextResponse.json({ message: "รูปถ่ายจากบัตรไม่ถูกต้อง" }, { status: 400, headers: noStore });
  if (nationalId && await prisma.member.findFirst({ where: { organizationId, nationalId, id: { not: id }, employmentStatus: "active" }, select: { id: true } })) {
    return NextResponse.json({ message: "เลขประจำตัวประชาชนนี้มีในทะเบียนผู้กู้แล้ว" }, { status: 409, headers: noStore });
  }

  try {
    const member = await prisma.$transaction(async (transaction) => {
      const department = await findOrCreateDepartment(clean(body.team), transaction);
      const result = await transaction.member.updateMany({
        where: { id, organizationId, employmentStatus: "active" },
        data: {
          departmentId: department?.id ?? null,
          employeeCode: clean(body.employeeCode),
          fullName: name,
          nickname: clean(body.nickname),
          phone: clean(body.phone),
          nationalId,
          address: clean(body.address),
          dateOfBirth: clean(body.dateOfBirth),
          photoData,
        },
      });
      if (!result.count) return null;
      return transaction.member.findUnique({ where: { id }, select: memberSelect() });
    });
    if (!member) return NextResponse.json({ message: "ไม่พบสมาชิก" }, { status: 404, headers: noStore });
    return NextResponse.json({ member: formatMember(member) }, { headers: noStore });
  } catch (error) {
    return NextResponse.json(
      { message: isUniqueConstraintError(error) ? "รหัสสมาชิกนี้ถูกใช้แล้ว" : "แก้ไขสมาชิกไม่สำเร็จ" },
      { status: isUniqueConstraintError(error) ? 409 : 500, headers: noStore },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: { id?: unknown };
  try { body = await request.json() as { id?: unknown }; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const id = clean(body.id);
  if (!id) return NextResponse.json({ message: "ไม่พบรหัสสมาชิก" }, { status: 400, headers: noStore });

  const result = await prisma.member.updateMany({
    where: { id, organizationId, employmentStatus: "active" },
    data: { employmentStatus: "inactive" },
  });
  if (!result.count) return NextResponse.json({ message: "ไม่พบสมาชิก" }, { status: 404, headers: noStore });
  return NextResponse.json({ ok: true }, { headers: noStore });
}
