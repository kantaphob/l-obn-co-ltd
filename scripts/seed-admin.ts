import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error("Set ADMIN_USERNAME and ADMIN_PASSWORD in .env.local before seeding the admin account.");
  }

  const [{ prisma }, { hashPassword }] = await Promise.all([
    import("../lib/prisma"),
    import("../lib/password"),
  ]);

  const role = await prisma.role.upsert({
    where: { code: "ADMIN" },
    update: { name: "ผู้ดูแลระบบ", description: "เข้าถึงและจัดการข้อมูลทุกส่วน" },
    create: { code: "ADMIN", name: "ผู้ดูแลระบบ", description: "เข้าถึงและจัดการข้อมูลทุกส่วน" },
  });

  await prisma.rolePermission.upsert({
    where: { roleId_permission: { roleId: role.id, permission: "*" } },
    update: {},
    create: { roleId: role.id, permission: "*" },
  });

  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { username },
    update: {
      password: passwordHash,
      roleId: role.id,
    },
    create: {
      acccode: process.env.ADMIN_ACCCODE?.trim() || "OWNER",
      username,
      password: passwordHash,
      roleId: role.id,
    },
  });

  console.info(`Admin account ${username} is ready with full access.`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error("Could not save the admin account to the database.", error);
  process.exitCode = 1;
});
