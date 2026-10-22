import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromToken, sessionCookie } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

const organizationId = "org_lobn";
const noStore = { "Cache-Control": "no-store" };
const statusToUi: Record<string, string> = {
  pending: "รอพิจารณา",
  approved: "อนุมัติแล้ว",
  needs_documents: "เอกสารไม่ครบ",
  rejected: "ปฏิเสธ",
};
const statusFromUi: Record<string, string> = Object.fromEntries(Object.entries(statusToUi).map(([key, value]) => [value, key]));

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(date);
}

function toLoan(application: {
  id: string; applicationNo: string; memberId: string; purpose: string; requestedAmountSatang: bigint; requestedInstallments: number;
  status: string; submittedAt: Date; note: string | null; member: { fullName: string; department: { name: string } | null };
}) {
  const name = application.member.fullName;
  return {
    id: application.applicationNo,
    memberId: application.memberId,
    name,
    initials: name.replace(/\s+/g, "").slice(0, 2),
    color: "mint",
    team: application.member.department?.name ?? "สมาชิก",
    purpose: application.purpose,
    amount: Number(application.requestedAmountSatang) / 100,
    term: application.requestedInstallments,
    date: dateLabel(application.submittedAt),
    status: statusToUi[application.status] ?? "รอพิจารณา",
    score: 0,
    recorder: application.note?.startsWith("ฝ่ายบันทึก: ACS") ? "ACS" : "—",
  };
}

async function authorized(request: NextRequest) {
  return Boolean(await getSessionFromToken(request.cookies.get(sessionCookie.name)?.value));
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  const applications = await prisma.loanApplication.findMany({
    where: { organizationId },
    include: { member: { include: { department: { select: { name: true } } } } },
    orderBy: [{ submittedAt: "desc" }, { applicationNo: "desc" }],
  });
  return NextResponse.json({ loans: applications.map(toLoan) }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }

  const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const amount = Number(body.amount);
  const installments = Number(body.installments);
  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  const memberName = typeof body.memberName === "string" ? body.memberName.trim() : "";
  if (!purpose || purpose.length > 120 || !Number.isFinite(amount) || amount < 1000 || amount > 100_000_000
    || !Number.isInteger(installments) || installments < 1 || installments > 36 || (!memberId && !memberName)) {
    return NextResponse.json({ message: "กรุณาตรวจสอบวัตถุประสงค์ ผู้กู้ วงเงิน และจำนวนงวด" }, { status: 400, headers: noStore });
  }

  const id = randomUUID();
  const applicationNo = `LN-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${id.slice(0, 4).toUpperCase()}`;
  try {
    const application = await prisma.$transaction(async (transaction) => {
      let resolvedMemberId = memberId;
      if (memberId) {
        const member = await transaction.member.findFirst({ where: { id: memberId, organizationId, employmentStatus: "active" }, select: { id: true } });
        if (!member) throw new Error("ไม่พบสมาชิกที่เลือก");
      } else {
        const member = await transaction.member.create({ data: { organizationId, fullName: memberName } });
        resolvedMemberId = member.id;
      }
      return transaction.loanApplication.create({
        data: {
          id, applicationNo, organizationId, memberId: resolvedMemberId, purpose,
          requestedAmountSatang: BigInt(Math.round(amount * 100)), requestedInstallments: installments,
          note: note || null,
        },
        include: { member: { include: { department: { select: { name: true } } } } },
      });
    });
    return NextResponse.json({ loan: toLoan(application) }, { status: 201, headers: noStore });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error && error.message === "ไม่พบสมาชิกที่เลือก" ? error.message : "บันทึกคำขอกู้ยืมไม่สำเร็จ" }, { status: 400, headers: noStore });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const applicationNo = typeof body.id === "string" ? body.id.trim() : "";
  const status = typeof body.status === "string" ? statusFromUi[body.status] : undefined;
  if (!applicationNo || !status) return NextResponse.json({ message: "สถานะคำขอไม่ถูกต้อง" }, { status: 400, headers: noStore });
  const result = await prisma.loanApplication.updateMany({
    where: { applicationNo, organizationId },
    data: { status, reviewedAt: new Date(), decisionNote: typeof body.note === "string" ? body.note.trim() || null : null },
  });
  if (!result.count) return NextResponse.json({ message: "ไม่พบคำขอกู้ยืม" }, { status: 404, headers: noStore });
  return NextResponse.json({ ok: true }, { headers: noStore });
}
