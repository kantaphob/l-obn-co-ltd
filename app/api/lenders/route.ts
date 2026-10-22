import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "../../../generated/prisma/client";
import { getSessionFromToken, sessionCookie } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { nextRunningNumber } from "../../../lib/running-number";
import { resolveAddressCodes } from "../../../lib/thai-addresses";

const organizationId = "org_lobn";
const noStore = { "Cache-Control": "no-store" };
type Input = Record<string, unknown> & { id?: unknown };
const fields = { id: true, lenderNo: true, nationalId: true, fullName: true, nameEn: true, dateOfBirth: true, gender: true, address: true, houseNumber: true, soi: true, road: true, subdistrictCode: true, subdistrict: true, districtCode: true, district: true, provinceCode: true, province: true, postcode: true, cardIssuer: true, cardIssuedOn: true, cardExpiresOn: true, photoData: true, source: true, kycVerifiedAt: true, kycMethod: true, createdAt: true } as const;
function clean(value: unknown) { return typeof value === "string" ? value.trim() || null : null; }
function format(row: { id: string; lenderNo: string; nationalId: string; fullName: string; nameEn: string | null; dateOfBirth: string | null; gender: string | null; address: string | null; houseNumber: string | null; soi: string | null; road: string | null; subdistrictCode: string | null; subdistrict: string | null; districtCode: string | null; district: string | null; provinceCode: string | null; province: string | null; postcode: string | null; cardIssuer: string | null; cardIssuedOn: string | null; cardExpiresOn: string | null; photoData: string | null; source: string; kycVerifiedAt: Date | null; kycMethod: string | null; createdAt: Date }) {
  return { ...row, kycVerifiedAt: row.kycVerifiedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() };
}
async function authorized(request: NextRequest) { return Boolean(await getSessionFromToken(request.cookies.get(sessionCookie.name)?.value)); }
function errorResponse(error: unknown) {
  const unique = typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  return NextResponse.json({ message: unique ? "เลขประจำตัวประชาชนนี้มีในทะเบียนผู้ให้กู้แล้ว" : "บันทึกข้อมูลผู้ให้กู้ไม่สำเร็จ" }, { status: unique ? 409 : 500, headers: noStore });
}
async function validate(body: Input) {
  const nationalId = clean(body.nationalId);
  const fullName = clean(body.fullName);
  if (!nationalId || !/^\d{13}$/.test(nationalId)) return { error: "กรุณาระบุเลขประจำตัวประชาชน 13 หลัก" };
  if (!fullName) return { error: "กรุณาระบุชื่อผู้ให้กู้" };
  const photoData = clean(body.photoData);
  if (photoData && (photoData.length > 100_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(photoData))) return { error: "รูปถ่ายจากบัตรไม่ถูกต้อง" };
  const houseNumber = clean(body.houseNumber);
  const soi = clean(body.soi);
  const road = clean(body.road);
  const subdistrictCode = clean(body.subdistrictCode);
  const districtCode = clean(body.districtCode);
  const provinceCode = clean(body.provinceCode);
  const anyLocation = Boolean(subdistrictCode || districtCode || provinceCode);
  const location = anyLocation && subdistrictCode && districtCode && provinceCode ? await resolveAddressCodes(subdistrictCode, districtCode, provinceCode) : null;
  if (anyLocation && !location) return { error: "กรุณาเลือกตำบล อำเภอ และจังหวัดจากรายการให้ครบ" };
  const postcode = location ? location.subdistrict.postcode || clean(body.postcode) : null;
  const composedAddress = [houseNumber, soi && `ซอย${soi}`, road && `ถนน${road}`, location?.subdistrict.name && `ตำบล${location.subdistrict.name}`, location?.district.name && `อำเภอ${location.district.name}`, location?.province.name && `จังหวัด${location.province.name}`, postcode].filter(Boolean).join(" ");
  const source = clean(body.source) === "ACS ACR39U" ? "ACS ACR39U" : "manual";
  return { data: {
    nationalId, fullName, nameEn: clean(body.nameEn), dateOfBirth: clean(body.dateOfBirth), gender: clean(body.gender),
    address: location ? composedAddress || clean(body.address) : clean(body.address), houseNumber, soi, road,
    subdistrictCode: location?.subdistrict.id ?? null, subdistrict: location?.subdistrict.name ?? null,
    districtCode: location?.district.id ?? null, district: location?.district.name ?? null,
    provinceCode: location?.province.id ?? null, province: location?.province.name ?? null, postcode,
    cardIssuer: clean(body.cardIssuer), cardIssuedOn: clean(body.cardIssuedOn), cardExpiresOn: clean(body.cardExpiresOn), photoData, source,
    kycVerifiedAt: source === "ACS ACR39U" ? new Date() : null,
    kycMethod: source === "ACS ACR39U" ? "ACS ACR39U" : null,
  } };
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  const rows = await prisma.lender.findMany({ where: { organizationId, status: "active" }, select: fields, orderBy: { fullName: "asc" } });
  return NextResponse.json({ lenders: rows.map(format) }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: Input;
  try { body = await request.json() as Input; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const parsed = await validate(body);
  if ("error" in parsed) return NextResponse.json({ message: parsed.error }, { status: 400, headers: noStore });
  try {
    const existing = await prisma.lender.findUnique({ where: { organizationId_nationalId: { organizationId, nationalId: parsed.data.nationalId } }, select: { id: true, lenderNo: true, status: true } });
    if (existing?.status === "active") return NextResponse.json({ message: "เลขประจำตัวประชาชนนี้มีในทะเบียนผู้ให้กู้แล้ว" }, { status: 409, headers: noStore });
    const lenderNo = existing?.lenderNo ?? await nextRunningNumber({ scope: organizationId, series: "LND", prefix: "LND", width: 6 });
    const lender = await prisma.lender.upsert({
      where: { organizationId_nationalId: { organizationId, nationalId: parsed.data.nationalId } },
      create: { id: randomUUID(), organizationId, lenderNo, ...parsed.data },
      update: { lenderNo, ...parsed.data, status: "active" },
      select: fields,
    });
    return NextResponse.json({ lender: format(lender) }, { status: 201, headers: noStore });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: Input;
  try { body = await request.json() as Input; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const id = clean(body.id);
  const parsed = await validate(body);
  if (!id || "error" in parsed) return NextResponse.json({ message: "error" in parsed ? parsed.error : "ไม่พบรหัสผู้ให้กู้" }, { status: 400, headers: noStore });
  try {
    const updated = await prisma.lender.updateMany({ where: { id, organizationId, status: "active" }, data: { ...parsed.data, photoData: body.photoData === undefined ? undefined : parsed.data.photoData } as Prisma.LenderUpdateManyMutationInput });
    if (!updated.count) return NextResponse.json({ message: "ไม่พบผู้ให้กู้" }, { status: 404, headers: noStore });
    const lender = await prisma.lender.findUnique({ where: { id }, select: fields });
    return NextResponse.json({ lender: lender ? format(lender) : null }, { headers: noStore });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: { id?: unknown };
  try { body = await request.json() as { id?: unknown }; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const id = clean(body.id);
  if (!id) return NextResponse.json({ message: "ไม่พบรหัสผู้ให้กู้" }, { status: 400, headers: noStore });
  const result = await prisma.lender.updateMany({ where: { id, organizationId, status: "active" }, data: { status: "inactive" } });
  if (!result.count) return NextResponse.json({ message: "ไม่พบผู้ให้กู้" }, { status: 404, headers: noStore });
  return NextResponse.json({ ok: true }, { headers: noStore });
}
