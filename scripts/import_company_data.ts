import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { prisma } from "../lib/prisma";

const organizationId = "org_lobn";
const organizationName = "บริษัท ลอบน์ จำกัด";
type CsvRow = Record<string, string>;

function clean(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseCsv(content: string): CsvRow[] {
  return parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];
}

function amountSatang(value: unknown) {
  const normalized = clean(value)?.replaceAll(",", "");
  if (!normalized) return BigInt(0);
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error(`Invalid amount in CSV: ${normalized}`);
  const sign = match[1] === "-" ? BigInt(-1) : BigInt(1);
  const whole = BigInt(match[2]);
  const fraction = BigInt((match[3] ?? "").padEnd(2, "0") || "0");
  return sign * (whole * BigInt(100) + fraction);
}

function percent(value: unknown) {
  const normalized = clean(value)?.replace(/%/g, "");
  if (!normalized) return null;
  const result = Number(normalized);
  if (!Number.isFinite(result)) throw new Error(`Invalid percentage in CSV: ${normalized}`);
  return result;
}

function stableRow(row: CsvRow) {
  return Object.fromEntries(Object.entries(row).sort(([left], [right]) => left.localeCompare(right)));
}

function dateTimeUtc(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid transaction date in CSV: ${date}`);
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  const hour = match ? Number(match[1]) : 0;
  const minute = match ? Number(match[2]) : 0;
  if (hour > 23 || minute > 59) throw new Error(`Invalid transaction time in CSV: ${time}`);

  const [year, month, day] = date.split("-").map(Number);
  const localDate = new Date(Date.UTC(year, month - 1, day));
  if (localDate.getUTCFullYear() !== year || localDate.getUTCMonth() !== month - 1 || localDate.getUTCDate() !== day) {
    throw new Error(`Invalid transaction date in CSV: ${date}`);
  }
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
}

async function importData(borrowerPath: string, ledgerPath: string) {
  const [borrowerContent, ledgerContent] = await Promise.all([
    readFile(borrowerPath, "utf8"),
    readFile(ledgerPath, "utf8"),
  ]);
  const borrowers = parseCsv(borrowerContent);
  const ledgerRows = parseCsv(ledgerContent);

  await prisma.organization.upsert({
    where: { id: organizationId },
    update: { name: organizationName },
    create: { id: organizationId, name: organizationName },
  });

  const memberIdsByCode = new Map<string, string>();
  for (const row of borrowers) {
    const employeeCode = clean(row["รหัสผู้กู้"]);
    const fullName = clean(row["ชื่อ"]);
    if (!employeeCode || !fullName) continue;

    const rawNationalId = clean(row["เลขบัตรประชาชน"]);
    const nationalId = rawNationalId?.includes("ไม่มี") ? null : rawNationalId;
    const memberId = employeeCode;
    const member = await prisma.member.upsert({
      where: { organizationId_employeeCode: { organizationId, employeeCode } },
      update: {
        fullName,
        nickname: clean(row["ชื่อเล่น"]),
        phone: clean(row["โทรศัพท์"]),
        nationalId,
        address: clean(row["ที่อยู่"]),
        dateOfBirth: clean(row["วันเกิด"]),
        note: clean(row["หมายเหตุ"]),
        employmentStatus: "active",
      },
      create: {
        id: memberId,
        organizationId,
        employeeCode,
        fullName,
        nickname: clean(row["ชื่อเล่น"]),
        phone: clean(row["โทรศัพท์"]),
        nationalId,
        address: clean(row["ที่อยู่"]),
        dateOfBirth: clean(row["วันเกิด"]),
        note: clean(row["หมายเหตุ"]),
      },
      select: { id: true },
    });
    memberIdsByCode.set(employeeCode, member.id);
  }

  const memberRows = await prisma.member.findMany({
    where: { organizationId, employeeCode: { not: null } },
    select: { id: true, employeeCode: true },
  });
  for (const member of memberRows) {
    if (member.employeeCode) memberIdsByCode.set(member.employeeCode, member.id);
  }

  for (const row of ledgerRows) {
    const transactionDate = clean(row["วันที่"]);
    if (!transactionDate) continue;
    const rawTime = clean(row["เวลา"]);
    const transactionTime = rawTime && /^\d{1,2}:\d{2}$/.test(rawTime)
      ? `${rawTime.split(":")[0].padStart(2, "0")}:${rawTime.split(":")[1]}`
      : "00:00";
    const occurredAt = dateTimeUtc(transactionDate, transactionTime);
    const relatedParty = clean(row["ผู้เกี่ยวข้อง"]);
    const memberCode = relatedParty?.match(/\bBO\d{6}\b/)?.[0];
    const typeValue = clean(row["ประเภท"]);
    const entryType = typeValue === "รายรับ" ? "income" : typeValue === "รายจ่าย" ? "expense" : null;
    if (!entryType) throw new Error(`Unknown ledger type: ${typeValue ?? "(empty)"}`);

    const importKey = createHash("sha256")
      .update(JSON.stringify(stableRow(row)), "utf8")
      .digest("hex");
    const baseAmountSatang = amountSatang(row["ยอดฐาน (บาท)"]);
    const vatAmountSatang = amountSatang(row["VAT (บาท)"]);
    const withholdingAmountSatang = amountSatang(row["WHT (บาท)"]);
    const netIncomeSatang = amountSatang(row["รายรับสุทธิ (บาท)"]);
    const netExpenseSatang = amountSatang(row["รายจ่ายสุทธิ (บาท)"]);
    const entry = {
      organizationId,
      occurredAt,
      transactionDate,
      transactionTime,
      transactionNo: clean(row["เลขที่รายการ"]),
      headquartersCode: clean(row["รหัสสำนักงานใหญ่"]),
      branchCode: clean(row["รหัสสาขา"]),
      entryType,
      description: clean(row["รายการ"]) ?? "",
      category: clean(row["หมวดหมู่"]) ?? "",
      memberId: memberCode ? memberIdsByCode.get(memberCode) ?? null : null,
      relatedParty,
      paymentChannel: clean(row["ช่องทาง"]),
      referenceNo: clean(row["เลขอ้างอิง"]),
      sourceLabel: clean(row["แหล่งข้อมูล"]),
      baseAmountSatang,
      vatPercent: percent(row["VAT (%)"]),
      vatAmountSatang,
      withholdingPercent: percent(row["WHT (%)"]),
      withholdingAmountSatang,
      netIncomeSatang,
      netExpenseSatang,
      note: clean(row["หมายเหตุ"]),
    };
    await prisma.companyLedgerEntry.upsert({
      where: { importKey },
      update: entry,
      create: { ...entry, id: `ledger_${importKey.slice(0, 24)}`, importKey },
    });
  }

  const [memberCount, ledgerCount] = await Promise.all([
    prisma.member.count({ where: { organizationId } }),
    prisma.companyLedgerEntry.count({ where: { organizationId } }),
  ]);
  console.log(`Imported borrower records: ${memberCount}`);
  console.log(`Imported company ledger records: ${ledgerCount}`);
}

const [borrowerPath, ledgerPath] = process.argv.slice(2);
if (!borrowerPath || !ledgerPath) {
  console.error("Usage: npm run data:import -- <borrowers.csv> <company-ledger.csv>");
  process.exitCode = 1;
} else {
  importData(borrowerPath, ledgerPath)
    .catch((error: unknown) => {
      console.error("Company data import failed.", error);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
