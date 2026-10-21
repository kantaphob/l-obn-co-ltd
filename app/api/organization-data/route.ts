import { NextRequest, NextResponse } from "next/server";
import { getSessionFromToken, sessionCookie } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getSessionFromToken(request.cookies.get(sessionCookie.name)?.value);
  if (!session) {
    return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const [members, entries] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId: "org_lobn", employmentStatus: "active" },
      select: { id: true, employeeCode: true, fullName: true, nickname: true },
      orderBy: { employeeCode: "asc" },
    }),
    prisma.companyLedgerEntry.findMany({
      where: { organizationId: "org_lobn" },
      select: {
        id: true,
        transactionDate: true,
        transactionTime: true,
        entryType: true,
        description: true,
        category: true,
        relatedParty: true,
        netIncomeSatang: true,
        netExpenseSatang: true,
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    }),
  ]);

  const ledger = entries.map((entry) => ({
    id: entry.id,
    date: entry.transactionDate,
    time: entry.transactionTime,
    type: entry.entryType,
    description: entry.description,
    category: entry.category,
    relatedParty: entry.relatedParty,
    incomeSatang: Number(entry.netIncomeSatang),
    expenseSatang: Number(entry.netExpenseSatang),
  }));

  return NextResponse.json({
    members: members.map((member) => ({
      id: member.id,
      employeeCode: member.employeeCode,
      name: member.fullName,
      nickname: member.nickname,
    })),
    ledger,
  }, { headers: { "Cache-Control": "no-store" } });
}
