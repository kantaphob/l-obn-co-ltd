import { NextRequest, NextResponse } from "next/server";
import { getSessionFromToken, sessionCookie } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const session = await getSessionFromToken(request.cookies.get(sessionCookie.name)?.value);
  if (!session) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });

  try {
    const [members, entries] = await Promise.all([
      prisma.borrowerProfile.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, borrowerNo: true, name: true, surname: true, nickname: true, departmentName: true },
        orderBy: [{ borrowerNo: "asc" }, { id: "asc" }],
      }),
      prisma.companyLedgerEntry.findMany({
        where: { organizationId: "org_lobn" },
        select: {
          id: true, transactionDate: true, transactionTime: true, entryType: true, description: true,
          category: true, relatedParty: true, netIncomeSatang: true, netExpenseSatang: true,
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      }),
    ]);

    return NextResponse.json({
      members: members.map((member) => ({
        id: String(member.id), employeeCode: member.borrowerNo,
        name: [member.name, member.surname].filter(Boolean).join(" "), nickname: member.nickname, team: member.departmentName,
      })),
      ledger: entries.map((entry) => ({
        id: entry.id, date: entry.transactionDate, time: entry.transactionTime, type: entry.entryType,
        description: entry.description, category: entry.category, relatedParty: entry.relatedParty,
        incomeSatang: Number(entry.netIncomeSatang), expenseSatang: Number(entry.netExpenseSatang),
      })),
    }, { headers: noStore });
  } catch {
    return NextResponse.json({ message: "อ่านข้อมูลสมาชิกและบัญชีบริษัทไม่สำเร็จ" }, { status: 500, headers: noStore });
  }
}
