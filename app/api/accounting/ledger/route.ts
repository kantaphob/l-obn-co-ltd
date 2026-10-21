import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromToken, sessionCookie } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;

export async function POST(request: NextRequest) {
  const session = await getSessionFromToken(request.cookies.get(sessionCookie.name)?.value);
  if (!session) {
    return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const type = body.type;
  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  const relatedParty = typeof body.relatedParty === "string" ? body.relatedParty.trim() : "";
  const paymentChannel = typeof body.paymentChannel === "string" ? body.paymentChannel.trim() : "";
  const referenceNo = typeof body.referenceNo === "string" ? body.referenceNo.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if ((type !== "income" && type !== "expense") || !datePattern.test(date) || !timePattern.test(time)
    || !description || description.length > 180 || !category || category.length > 80
    || !Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
    return NextResponse.json({ message: "กรุณาตรวจสอบวันที่ รายละเอียด หมวดหมู่ และจำนวนเงิน" }, { status: 400 });
  }

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day || hour > 23 || minute > 59) {
    return NextResponse.json({ message: "วันที่หรือเวลาไม่ถูกต้อง" }, { status: 400 });
  }

  const id = randomUUID();
  const amountSatang = Math.round(amount * 100);
  const entry = await prisma.companyLedgerEntry.create({
    data: {
      id,
      importKey: `manual:${id}`,
      organizationId: "org_lobn",
      occurredAt: new Date(Date.UTC(year, month - 1, day, hour - 7, minute)),
      transactionDate: date,
      transactionTime: time,
      entryType: type,
      description,
      category,
      relatedParty: relatedParty || null,
      paymentChannel: paymentChannel || null,
      referenceNo: referenceNo || null,
      sourceLabel: "บันทึกด้วยตนเอง",
      baseAmountSatang: amountSatang,
      netIncomeSatang: type === "income" ? amountSatang : 0,
      netExpenseSatang: type === "expense" ? amountSatang : 0,
      note: note || null,
    },
    select: { id: true, transactionDate: true, transactionTime: true, entryType: true, description: true, category: true, relatedParty: true, netIncomeSatang: true, netExpenseSatang: true },
  });

  return NextResponse.json({ entry: {
    id: entry.id,
    date: entry.transactionDate,
    time: entry.transactionTime,
    type: entry.entryType,
    description: entry.description,
    category: entry.category,
    relatedParty: entry.relatedParty,
    incomeSatang: Number(entry.netIncomeSatang),
    expenseSatang: Number(entry.netExpenseSatang),
  } }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
