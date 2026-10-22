import { NextRequest, NextResponse } from "next/server";
import { getSessionFromToken, sessionCookie } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { nextRunningNumber } from "../../../lib/running-number";

const organizationId = "org_lobn";
const noStore = { "Cache-Control": "no-store" };
const statusToUi: Record<string, string> = {
  DRAFT: "รอพิจารณา", SUBMITTED: "รอพิจารณา", UNDER_REVIEW: "รอพิจารณา",
  MORE_INFO_REQUIRED: "เอกสารไม่ครบ", APPROVED: "อนุมัติแล้ว", REJECTED: "ปฏิเสธ",
  WITHDRAWN: "ปฏิเสธ", EXPIRED: "ปฏิเสธ",
};
const statusFromUi: Record<string, "UNDER_REVIEW" | "APPROVED" | "MORE_INFO_REQUIRED" | "REJECTED"> = {
  "รอพิจารณา": "UNDER_REVIEW", "อนุมัติแล้ว": "APPROVED", "เอกสารไม่ครบ": "MORE_INFO_REQUIRED", "ปฏิเสธ": "REJECTED",
};

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(date);
}
function toLoan(application: {
  id: number; applicationNo: string; borrowerId: number; purpose: string | null; requestedAmountSatang: bigint;
  requestedTermMonths: number; status: string; submittedAt: Date | null; createdAt: Date; decisionNote: string | null;
  borrower: { name: string; surname: string; departmentName: string | null };
}) {
  const name = [application.borrower.name, application.borrower.surname].filter(Boolean).join(" ");
  return {
    id: application.applicationNo, memberId: String(application.borrowerId), name,
    initials: name.replace(/\s+/g, "").slice(0, 2), color: "mint",
    team: application.borrower.departmentName ?? "สมาชิก", purpose: application.purpose ?? "ไม่ระบุวัตถุประสงค์",
    amount: Number(application.requestedAmountSatang) / 100, term: application.requestedTermMonths,
    date: dateLabel(application.submittedAt ?? application.createdAt),
    status: statusToUi[application.status] ?? "รอพิจารณา", score: 0,
    recorder: application.decisionNote?.startsWith("ฝ่ายบันทึก: ACS") ? "ACS" : "—",
  };
}
async function authorized(request: NextRequest) {
  return Boolean(await getSessionFromToken(request.cookies.get(sessionCookie.name)?.value));
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  try {
    const applications = await prisma.loanApplication.findMany({
      include: { borrower: { select: { name: true, surname: true, departmentName: true } } },
      orderBy: [{ submittedAt: "desc" }, { applicationNo: "desc" }],
    });
    return NextResponse.json({ loans: applications.map(toLoan) }, { headers: noStore });
  } catch {
    return NextResponse.json({ message: "อ่านคำขอกู้ไม่สำเร็จ" }, { status: 500, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const amount = Number(body.amount);
  const installments = Number(body.installments);
  const memberId = typeof body.memberId === "string" ? Number(body.memberId) : NaN;
  const memberName = typeof body.memberName === "string" ? body.memberName.trim() : "";
  if (!purpose || purpose.length > 120 || !Number.isFinite(amount) || amount < 1000 || amount > 100_000_000
    || !Number.isInteger(installments) || installments < 1 || installments > 36 || (!Number.isInteger(memberId) && !memberName)) {
    return NextResponse.json({ message: "กรุณาตรวจสอบวัตถุประสงค์ ผู้กู้ วงเงิน และจำนวนงวด" }, { status: 400, headers: noStore });
  }
  const buddhistYear = Number(new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date())) + 543;
  try {
    const applicationNo = await nextRunningNumber({ scope: organizationId, series: "APPLICATION", period: String(buddhistYear), prefix: `LN-${buddhistYear}`, width: 6 });
    const application = await prisma.$transaction(async (transaction) => {
      let borrowerId = memberId;
      if (!Number.isInteger(borrowerId)) {
        const [name, ...surname] = memberName.split(/\s+/);
        const borrower = await transaction.borrowerProfile.create({
          data: { name, surname: surname.join(" ") || "-", phone: null, status: "ACTIVE" },
          select: { id: true },
        });
        borrowerId = borrower.id;
      } else {
        const borrower = await transaction.borrowerProfile.findFirst({ where: { id: borrowerId, status: "ACTIVE" }, select: { id: true } });
        if (!borrower) throw new Error("ไม่พบสมาชิกที่เลือก");
      }
      return transaction.loanApplication.create({
        data: {
          applicationNo, borrowerId, purpose, status: "SUBMITTED", submittedAt: new Date(),
          requestedAmountSatang: BigInt(Math.round(amount * 100)), requestedTermMonths: installments,
          decisionNote: note || null,
        },
        include: { borrower: { select: { name: true, surname: true, departmentName: true } } },
      });
    });
    return NextResponse.json({ loan: toLoan(application) }, { status: 201, headers: noStore });
  } catch (error) {
    const missing = error instanceof Error && error.message === "ไม่พบสมาชิกที่เลือก";
    return NextResponse.json({ message: missing ? error.message : "บันทึกคำขอกู้ยืมไม่สำเร็จ" }, { status: missing ? 404 : 500, headers: noStore });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const applicationNo = typeof body.id === "string" ? body.id.trim() : "";
  const status = typeof body.status === "string" ? statusFromUi[body.status] : undefined;
  if (!applicationNo || !status) return NextResponse.json({ message: "สถานะคำขอไม่ถูกต้อง" }, { status: 400, headers: noStore });
  try {
    const result = await prisma.loanApplication.updateMany({
      where: { applicationNo },
      data: { status, decidedAt: status === "APPROVED" || status === "REJECTED" ? new Date() : null, decisionNote: typeof body.note === "string" ? body.note.trim() || null : undefined },
    });
    if (!result.count) return NextResponse.json({ message: "ไม่พบคำขอกู้ยืม" }, { status: 404, headers: noStore });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return NextResponse.json({ message: "บันทึกสถานะคำขอไม่สำเร็จ" }, { status: 500, headers: noStore });
  }
}
