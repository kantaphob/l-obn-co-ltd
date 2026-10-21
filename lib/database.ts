import Database from "better-sqlite3";

type DatabaseCache = typeof globalThis & { loanDatabase?: InstanceType<typeof Database> };

const globalForDatabase = globalThis as DatabaseCache;

export function getDatabase() {
  if (!globalForDatabase.loanDatabase) {
    const configuredPath = process.env.DATABASE_URL?.replace(/^file:/, "") || ".data/loans.sqlite";
    globalForDatabase.loanDatabase = new Database(configuredPath);
    globalForDatabase.loanDatabase.pragma("foreign_keys = ON");
  }
  return globalForDatabase.loanDatabase;
}
