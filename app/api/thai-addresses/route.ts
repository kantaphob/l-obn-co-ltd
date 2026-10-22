import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

const headers = { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" };

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const level = query.get("level");
  if (level === "provinces") {
    const rows = await prisma.province.findMany({ orderBy: { id: "asc" }, select: { id: true, nameTh: true, nameEn: true } });
    return NextResponse.json({ items: rows.map((item) => ({ id: String(item.id), name: item.nameTh, nameEn: item.nameEn ?? "" })) }, { headers });
  }
  if (level === "districts") {
    const provinceId = query.get("provinceId");
    if (!provinceId) return NextResponse.json({ message: "กรุณาเลือกจังหวัด" }, { status: 400, headers });
    if (!/^\d+$/.test(provinceId)) return NextResponse.json({ message: "รหัสจังหวัดไม่ถูกต้อง" }, { status: 400, headers });
    const rows = await prisma.district.findMany({ where: { provinceId: Number(provinceId) }, orderBy: { id: "asc" }, select: { id: true, provinceId: true, nameTh: true, nameEn: true } });
    return NextResponse.json({ items: rows.map((item) => ({ id: String(item.id), provinceId: String(item.provinceId), name: item.nameTh, nameEn: item.nameEn ?? "" })) }, { headers });
  }
  if (level === "subdistricts") {
    const districtId = query.get("districtId");
    if (!districtId) return NextResponse.json({ message: "กรุณาเลือกอำเภอ" }, { status: 400, headers });
    if (!/^\d+$/.test(districtId)) return NextResponse.json({ message: "รหัสอำเภอไม่ถูกต้อง" }, { status: 400, headers });
    const rows = await prisma.subdistrict.findMany({ where: { districtId: Number(districtId) }, orderBy: { id: "asc" }, select: { id: true, districtId: true, nameTh: true, nameEn: true, postcode: true } });
    return NextResponse.json({ items: rows.map((item) => ({ id: String(item.id), districtId: String(item.districtId), name: item.nameTh, nameEn: item.nameEn ?? "", postcode: item.postcode ?? "" })) }, { headers });
  }
  return NextResponse.json({ message: "ระดับข้อมูลไม่ถูกต้อง" }, { status: 400, headers });
}
