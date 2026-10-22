import { prisma } from "../lib/prisma";

const roles = [
  {
    code: "ADMIN",
    name: "ผู้ดูแลระบบ",
    description: "จัดการผู้ใช้ สิทธิ์ และข้อมูลทั้งหมด",
    permissions: ["users:manage", "roles:manage", "loans:manage", "borrowers:manage", "reports:read"],
  },
  {
    code: "STAFF",
    name: "พนักงานสินเชื่อ",
    description: "ตรวจสอบผู้กู้ คำขอสินเชื่อ และการรับชำระ",
    permissions: ["borrowers:read", "verifications:review", "applications:review", "payments:manage", "reports:read"],
  },
  {
    code: "BORROWER",
    name: "ผู้กู้",
    description: "จัดการข้อมูลและคำขอสินเชื่อของตนเอง",
    permissions: ["profile:read", "profile:update", "applications:create", "documents:manage", "payments:read"],
  },
] as const;

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: "org_lobn" },
    update: { name: "บริษัท ลอบน์ จำกัด" },
    create: { id: "org_lobn", name: "บริษัท ลอบน์ จำกัด" },
  });

  for (const [settingKey, settingValue] of [["loan_limit_baht", "50000"], ["monthly_interest_percent", "0"]] as const) {
    await prisma.organizationSetting.upsert({
      where: { organizationId_settingKey: { organizationId: organization.id, settingKey } },
      update: { settingValue },
      create: { organizationId: organization.id, settingKey, settingValue },
    });
  }

  for (const roleData of roles) {
    const role = await prisma.role.upsert({
      where: { code: roleData.code },
      update: { name: roleData.name, description: roleData.description },
      create: { code: roleData.code, name: roleData.name, description: roleData.description },
    });

    for (const permission of roleData.permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permission: { roleId: role.id, permission } },
        update: {},
        create: { roleId: role.id, permission },
      });
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error("Prisma seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
