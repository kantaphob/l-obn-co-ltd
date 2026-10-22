import { NextRequest, NextResponse } from "next/server";
import { getSessionFromToken, sessionCookie } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

const noStore = { "Cache-Control": "no-store" };
type Level = "provinces" | "districts" | "subdistricts";
type Body = Record<string, unknown>;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function optionalText(value: unknown) {
  const text = clean(value);
  return text || null;
}

function optionalCoordinate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function isLevel(value: unknown): value is Level {
  return value === "provinces" || value === "districts" || value === "subdistricts";
}

async function adminSession(request: NextRequest) {
  const session = await getSessionFromToken(request.cookies.get(sessionCookie.name)?.value);
  return session?.role === "ADMIN" ? session : null;
}

function prismaError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  if (code === "P2002") return NextResponse.json({ message: "รหัสนี้มีอยู่แล้ว" }, { status: 409, headers: noStore });
  if (code === "P2003") return NextResponse.json({ message: "ลบไม่ได้ เพราะยังมีข้อมูลลูกอ้างอิงอยู่ กรุณาลบข้อมูลระดับล่างก่อน" }, { status: 409, headers: noStore });
  if (code === "P2025") return NextResponse.json({ message: "ไม่พบข้อมูลที่ต้องการ" }, { status: 404, headers: noStore });
  return NextResponse.json({ message: "บันทึกข้อมูลไม่สำเร็จ" }, { status: 500, headers: noStore });
}

export async function GET(request: NextRequest) {
  if (!(await adminSession(request))) return NextResponse.json({ message: "ไม่มีสิทธิ์จัดการข้อมูลหลัก" }, { status: 403, headers: noStore });

  const params = request.nextUrl.searchParams;
  const level = params.get("level");
  if (!isLevel(level)) return NextResponse.json({ message: "ระดับข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore });
  const query = clean(params.get("q"));
  const parentId = params.get("parentId") ? positiveInt(params.get("parentId")) : null;
  if (params.has("parentId") && !parentId) return NextResponse.json({ message: "รหัสข้อมูลแม่ไม่ถูกต้อง" }, { status: 400, headers: noStore });
  const page = Math.max(1, positiveInt(params.get("page")) ?? 1);
  const pageSize = Math.min(100, Math.max(5, positiveInt(params.get("pageSize")) ?? 8));
  const skip = (page - 1) * pageSize;
  const textFilter = query ? { OR: [{ nameTh: { contains: query } }, { nameEn: { contains: query } }] } : {};

  const counts = await Promise.all([prisma.province.count(), prisma.district.count(), prisma.subdistrict.count()]);
  if (level === "provinces") {
    const [items, total] = await Promise.all([
      prisma.province.findMany({ where: textFilter, orderBy: { id: "asc" }, skip, take: pageSize, include: { _count: { select: { districts: true } } } }),
      prisma.province.count({ where: textFilter }),
    ]);
    return NextResponse.json({ items, total, page, pageSize, counts: { provinces: counts[0], districts: counts[1], subdistricts: counts[2] } }, { headers: noStore });
  }
  if (level === "districts") {
    const where = { ...textFilter, ...(parentId ? { provinceId: parentId } : {}) };
    const [items, total] = await Promise.all([
      prisma.district.findMany({ where, orderBy: { id: "asc" }, skip, take: pageSize, include: { province: { select: { id: true, nameTh: true } }, _count: { select: { subdistricts: true } } } }),
      prisma.district.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize, counts: { provinces: counts[0], districts: counts[1], subdistricts: counts[2] } }, { headers: noStore });
  }

  const where = {
    ...(parentId ? { districtId: parentId } : {}),
    ...(query ? { OR: [{ nameTh: { contains: query } }, { nameEn: { contains: query } }, { postcode: { contains: query } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.subdistrict.findMany({ where, orderBy: { id: "asc" }, skip, take: pageSize, include: { district: { select: { id: true, nameTh: true, province: { select: { id: true, nameTh: true } } } } } }),
    prisma.subdistrict.count({ where }),
  ]);
  return NextResponse.json({ items, total, page, pageSize, counts: { provinces: counts[0], districts: counts[1], subdistricts: counts[2] } }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  if (!(await adminSession(request))) return NextResponse.json({ message: "ไม่มีสิทธิ์จัดการข้อมูลหลัก" }, { status: 403, headers: noStore });
  let body: Body;
  try { body = await request.json() as Body; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const level = body.level;
  const id = positiveInt(body.id);
  const nameTh = clean(body.nameTh);
  if (!isLevel(level) || (body.id !== undefined && body.id !== "" && !id) || !nameTh) return NextResponse.json({ message: "ระดับหรือรหัสไม่ถูกต้อง และต้องระบุชื่อภาษาไทย" }, { status: 400, headers: noStore });
  const nameEn = optionalText(body.nameEn);

  try {
    if (level === "provinces") {
      const item = await prisma.province.create({ data: { ...(id ? { id } : {}), nameTh, nameEn } });
      return NextResponse.json({ item }, { status: 201, headers: noStore });
    }
    if (level === "districts") {
      const provinceId = positiveInt(body.parentId);
      if (!provinceId || !(await prisma.province.findUnique({ where: { id: provinceId }, select: { id: true } }))) return NextResponse.json({ message: "กรุณาเลือกจังหวัดที่มีอยู่" }, { status: 400, headers: noStore });
      const item = await prisma.district.create({ data: { ...(id ? { id } : {}), provinceId, nameTh, nameEn } });
      return NextResponse.json({ item }, { status: 201, headers: noStore });
    }
    const districtId = positiveInt(body.parentId);
    if (!districtId || !(await prisma.district.findUnique({ where: { id: districtId }, select: { id: true } }))) return NextResponse.json({ message: "กรุณาเลือกอำเภอที่มีอยู่" }, { status: 400, headers: noStore });
    const latitude = optionalCoordinate(body.latitude);
    const longitude = optionalCoordinate(body.longitude);
    const postcode = optionalText(body.postcode);
    if (latitude === undefined || longitude === undefined) return NextResponse.json({ message: "พิกัดไม่ถูกต้อง" }, { status: 400, headers: noStore });
    if (postcode && !/^\d{5}$/.test(postcode)) return NextResponse.json({ message: "รหัสไปรษณีย์ต้องมี 5 หลัก" }, { status: 400, headers: noStore });
    const item = await prisma.subdistrict.create({ data: { ...(id ? { id } : {}), districtId, nameTh, nameEn, latitude, longitude, postcode } });
    return NextResponse.json({ item }, { status: 201, headers: noStore });
  } catch (error) { return prismaError(error); }
}

export async function PATCH(request: NextRequest) {
  if (!(await adminSession(request))) return NextResponse.json({ message: "ไม่มีสิทธิ์จัดการข้อมูลหลัก" }, { status: 403, headers: noStore });
  let body: Body;
  try { body = await request.json() as Body; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const level = body.level;
  const id = positiveInt(body.id);
  const nameTh = clean(body.nameTh);
  if (!isLevel(level) || !id || !nameTh) return NextResponse.json({ message: "กรุณาระบุระดับ รหัส และชื่อภาษาไทยให้ครบ" }, { status: 400, headers: noStore });
  const nameEn = optionalText(body.nameEn);

  try {
    if (level === "provinces") {
      const item = await prisma.province.update({ where: { id }, data: { nameTh, nameEn } });
      return NextResponse.json({ item }, { headers: noStore });
    }
    if (level === "districts") {
      const provinceId = positiveInt(body.parentId);
      if (!provinceId || !(await prisma.province.findUnique({ where: { id: provinceId }, select: { id: true } }))) return NextResponse.json({ message: "กรุณาเลือกจังหวัดที่มีอยู่" }, { status: 400, headers: noStore });
      const item = await prisma.district.update({ where: { id }, data: { provinceId, nameTh, nameEn } });
      return NextResponse.json({ item }, { headers: noStore });
    }
    const districtId = positiveInt(body.parentId);
    if (!districtId || !(await prisma.district.findUnique({ where: { id: districtId }, select: { id: true } }))) return NextResponse.json({ message: "กรุณาเลือกอำเภอที่มีอยู่" }, { status: 400, headers: noStore });
    const latitude = optionalCoordinate(body.latitude);
    const longitude = optionalCoordinate(body.longitude);
    const postcode = optionalText(body.postcode);
    if (latitude === undefined || longitude === undefined) return NextResponse.json({ message: "พิกัดไม่ถูกต้อง" }, { status: 400, headers: noStore });
    if (postcode && !/^\d{5}$/.test(postcode)) return NextResponse.json({ message: "รหัสไปรษณีย์ต้องมี 5 หลัก" }, { status: 400, headers: noStore });
    const item = await prisma.subdistrict.update({ where: { id }, data: { districtId, nameTh, nameEn, latitude, longitude, postcode } });
    return NextResponse.json({ item }, { headers: noStore });
  } catch (error) { return prismaError(error); }
}

export async function DELETE(request: NextRequest) {
  if (!(await adminSession(request))) return NextResponse.json({ message: "ไม่มีสิทธิ์จัดการข้อมูลหลัก" }, { status: 403, headers: noStore });
  let body: Body;
  try { body = await request.json() as Body; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const level = body.level;
  const id = positiveInt(body.id);
  if (!isLevel(level) || !id) return NextResponse.json({ message: "ระดับหรือรหัสข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore });
  try {
    if (level === "provinces") await prisma.province.delete({ where: { id } });
    else if (level === "districts") await prisma.district.delete({ where: { id } });
    else await prisma.subdistrict.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) { return prismaError(error); }
}
