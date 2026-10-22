import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionFromToken, sessionCookie } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { nextRunningNumber } from "../../../lib/running-number";

const noStore = { "Cache-Control": "no-store" };
const organizationId = "org_lobn";

function addMonth(date: Date, offset: number) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return result;
}
function contractDto(contract: {
  contractNo: string; principalSatang: bigint; interestRateBps: number; termMonths: number; signedAt: Date | null;
  status: string; repaymentMethod: string; application: { applicationNo: string };
  borrower: { name: string; surname: string; phone: string | null };
  installments: Array<{ dueAt: Date; principalDueSatang: bigint; interestDueSatang: bigint }>;
}) {
  const amount = Number(contract.principalSatang) / 100;
  const interestAmount = contract.installments.reduce((sum, installment) => sum + Number(installment.interestDueSatang), 0) / 100;
  const monthlyRate = contract.interestRateBps / 10_000 / 12;
  const monthlyPayment = Math.round(monthlyRate === 0
    ? amount / contract.termMonths
    : amount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -contract.termMonths)));
  return {
    id: contract.contractNo, applicationId: contract.application.applicationNo,
    name: [contract.borrower.name, contract.borrower.surname].filter(Boolean).join(" "), phone: contract.borrower.phone,
    amount, interestAmount, totalAmount: amount + interestAmount, installments: contract.termMonths,
    monthlyPayment, annualInterestRate: contract.interestRateBps / 100,
    signedOn: contract.signedAt?.toISOString().slice(0, 10) ?? "",
    firstDueOn: contract.installments[0]?.dueAt.toISOString().slice(0, 10) ?? "",
    repaymentMethod: contract.repaymentMethod,
    status: contract.status === "PENDING_SIGNATURE" ? "รอลงนาม" : contract.status,
  };
}
async function authorized(request: NextRequest) {
  return Boolean(await getSessionFromToken(request.cookies.get(sessionCookie.name)?.value));
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  try {
    const contracts = await prisma.loanContract.findMany({
      include: {
        application: { select: { applicationNo: true } },
        borrower: { select: { name: true, surname: true, phone: true } },
        installments: { select: { dueAt: true, principalDueSatang: true, interestDueSatang: true }, orderBy: { installmentNo: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ contracts: contracts.map(contractDto) }, { headers: noStore });
  } catch {
    return NextResponse.json({ message: "อ่านข้อมูลสัญญาไม่สำเร็จ" }, { status: 500, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const applicationNo = typeof body.applicationId === "string" ? body.applicationId.trim() : "";
  const amount = Number(body.amount);
  const count = Number(body.installments);
  const annualRate = Number(body.annualInterestRate);
  const firstDueOn = typeof body.firstDueOn === "string" ? body.firstDueOn : "";
  const repaymentMethod = typeof body.repaymentMethod === "string" ? body.repaymentMethod.trim() : "";
  if (!applicationNo || !Number.isFinite(amount) || amount <= 0 || amount > 100_000_000
    || !Number.isInteger(count) || count < 1 || count > 36 || !Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100
    || !/^\d{4}-\d{2}-\d{2}$/.test(firstDueOn) || !repaymentMethod) {
    return NextResponse.json({ message: "กรุณาตรวจสอบคำขอ วงเงิน จำนวนงวด อัตราดอกเบี้ย และวันครบกำหนด" }, { status: 400, headers: noStore });
  }
  const [year, month, day] = firstDueOn.split("-").map(Number);
  const firstDate = new Date(Date.UTC(year, month - 1, day));
  if (firstDate.toISOString().slice(0, 10) !== firstDueOn) return NextResponse.json({ message: "วันครบกำหนดไม่ถูกต้อง" }, { status: 400, headers: noStore });
  const buddhistYear = Number(new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date())) + 543;
  const id = randomUUID();
  const principalSatang = BigInt(Math.round(amount * 100));
  const monthlyRate = annualRate / 100 / 12;
  const paymentSatang = Math.round(Number(principalSatang) * (monthlyRate === 0 ? 1 / count : monthlyRate / (1 - Math.pow(1 + monthlyRate, -count))));
  try {
    const contractNo = await nextRunningNumber({ scope: organizationId, series: "CONTRACT", period: String(buddhistYear), prefix: `LOAN-${buddhistYear}`, width: 6 });
    const contract = await prisma.$transaction(async (transaction) => {
      const application = await transaction.loanApplication.findFirst({
        where: { applicationNo, status: "APPROVED", contract: null },
        select: { id: true, borrowerId: true, requestedAmountSatang: true, approvedAmountSatang: true },
      });
      if (!application) throw new Error("คำขอนี้ไม่มีสิทธิ์สร้างสัญญาหรือมีสัญญาแล้ว");
      const approvedAmount = application.approvedAmountSatang ?? application.requestedAmountSatang;
      if (principalSatang > approvedAmount) throw new Error("เงินต้นต้องไม่เกินวงเงินที่อนุมัติ");
      let remaining = Number(principalSatang);
      const schedule = Array.from({ length: count }, (_, index) => {
        const interest = Math.round(remaining * monthlyRate);
        const principal = index === count - 1 ? remaining : Math.min(remaining, Math.max(0, paymentSatang - interest));
        remaining -= principal;
        return {
          id: index + 1, installmentNo: index + 1, dueAt: addMonth(firstDate, index),
          principalDueSatang: BigInt(principal), interestDueSatang: BigInt(interest),
        };
      });
      return transaction.loanContract.create({
        data: {
          contractNo, applicationId: application.id, borrowerId: application.borrowerId,
          principalSatang, interestRateBps: Math.round(annualRate * 100), termMonths: count,
          repaymentMethod, maturityAt: schedule[schedule.length - 1].dueAt, status: "PENDING_SIGNATURE",
          installments: { create: schedule.map(({ id: _id, ...installment }) => installment) },
        },
        include: {
          application: { select: { applicationNo: true } },
          borrower: { select: { name: true, surname: true, phone: true } },
          installments: { select: { dueAt: true, principalDueSatang: true, interestDueSatang: true }, orderBy: { installmentNo: "asc" } },
        },
      });
    });
    return NextResponse.json({ contract: contractDto(contract) }, { status: 201, headers: noStore });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "บันทึกสัญญาไม่สำเร็จ" }, { status: 409, headers: noStore });
  }
}
