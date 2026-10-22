import { prisma } from "../lib/prisma";

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: "org_lobn" },
    update: { name: "บริษัท ลอบน์ จำกัด" },
    create: { id: "org_lobn", name: "บริษัท ลอบน์ จำกัด" },
  });

  const initialSettings = [
    ["loan_limit_baht", "50000"],
    ["monthly_interest_percent", "1.00"],
  ] as const;

  for (const [settingKey, settingValue] of initialSettings) {
    await prisma.organizationSetting.upsert({
      where: { organizationId_settingKey: { organizationId: organization.id, settingKey } },
      update: { settingValue },
      create: { organizationId: organization.id, settingKey, settingValue },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error("Prisma seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
