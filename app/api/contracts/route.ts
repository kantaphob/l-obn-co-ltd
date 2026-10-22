import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromToken, sessionCookie } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

const organizationId = "org_lobn";
const noStore = { "Cache-Control": "no-store" };

function addMonth(date: Date, offset: number) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return result.toISOString().slice(0, 10);
}

function contractDto(contract: {
  contractNo: string; applicationId: string; principalSatang: bigint; monthlyInterestRate: number;
  installmentCount: number; signedOn: string | null; firstDueOn: string | null; status: string;
  repaymentMethod: string; application: { applicationNo: string }; member: { fullName: string }; installments: Array<{ principalDueSatang: bigint; interestDueSatang: bigint }>;
}) {
  const amount = Number(contract.principalSatang) / 100;
  const monthlyRate = contract.monthlyInterestRate;
  const monthlyPayment = Math.round(monthlyRate === 0
    ? amount / contract.installmentCount
    : amount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -contract.installmentCount)));
  return {
    id: contract.contractNo,
    applicationId: contract.application.applicationNo,
    name: contract.member.fullName,
    amount,
    installments: contract.installmentCount,
    monthlyPayment,
    annualInterestRate: monthlyRate * 12 * 100,
    signedOn: contract.signedOn ?? "",
    firstDueOn: contract.firstDueOn ?? "",
    repaymentMethod: contract.repaymentMethod,
    status: contract.status === "pending_signature" ? "รอลงนาม" : contract.status,
  };
}

async function authorized(request: NextRequest) {
  return Boolean(await getSessionFromToken(request.cookies.get(sessionCookie.name)?.value));
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  const contracts = await prisma.loanContract.findMany({
    where: { application: { organizationId } },
    include: { application: { select: { applicationNo: true } }, member: { select: { fullName: true } }, installments: { select: { principalDueSatang: true, interestDueSatang: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ contracts: contracts.map(contractDto) }, { headers: noStore });
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

  const id = randomUUID();
  const contractNo = `CT-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${id.slice(0, 4).toUpperCase()}`;
  const principalSatang = BigInt(Math.round(amount * 100));
  const monthlyRate = annualRate / 100 / 12;
  const paymentSatang = Math.round(Number(principalSatang) * (monthlyRate === 0 ? 1 / count : monthlyRate / (1 - Math.pow(1 + monthlyRate, -count))));

  try {
    const contract = await prisma.$transaction(async (transaction) => {
      const application = await transaction.loanApplication.findFirst({
        where: { applicationNo, organizationId, status: "approved", contract: null },
        select: { id: true, memberId: true, requestedAmountSatang: true },
      });
      if (!application) throw new Error("คำขอนี้ไม่มีสิทธิ์สร้างสัญญาหรือมีสัญญาแล้ว");
      if (principalSatang > application.requestedAmountSatang) throw new Error("เงินต้นต้องไม่เกินวงเงินที่อนุมัติ");

      let remaining = Number(principalSatang);
      const schedule = Array.from({ length: count }, (_, index) => {
        const interest = Math.round(remaining * monthlyRate);
        const principal = index === count - 1 ? remaining : Math.min(remaining, Math.max(0, paymentSatang - interest));
        remaining -= principal;
        return {
          id: randomUUID(), installmentNo: index + 1, dueOn: addMonth(firstDate, index),
          principalDueSatang: BigInt(principal), interestDueSatang: BigInt(interest),
        };
      });
      return transaction.loanContract.create({
        data: {
          id, contractNo, applicationId: application.id, memberId: application.memberId, principalSatang,
          monthlyInterestRate: monthlyRate, installmentCount: count, repaymentMethod, firstDueOn,
          status: "pending_signature",
          installments: { create: schedule.map((item) => ({ ...item, status: "scheduled" })) },
        },
        include: { application: { select: { applicationNo: true } }, member: { select: { fullName: true } }, installments: { select: { principalDueSatang: true, interestDueSatang: true } } },
      });
    });
    return NextResponse.json({ contract: contractDto(contract) }, { status: 201, headers: noStore });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "บันทึกสัญญาไม่สำเร็จ" }, { status: 409, headers: noStore });
  }
}
