import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const cachedPrisma = globalForPrisma.prisma;
const hasAddressModels = cachedPrisma
  && "province" in cachedPrisma
  && "district" in cachedPrisma
  && "subdistrict" in cachedPrisma;

if (cachedPrisma && !hasAddressModels) {
  void cachedPrisma.$disconnect().catch(() => undefined);
}

export const prisma = hasAddressModels
  ? cachedPrisma!
  : new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? "file:./.data/loans.sqlite",
    }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
