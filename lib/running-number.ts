import { prisma } from "./prisma";

type RunningNumberOptions = {
  scope?: string;
  series: string;
  period?: string;
  prefix?: string;
  width?: number;
};

/** Atomically reserves a unique number within the requested scope, series, and period. */
export async function nextRunningNumber({
  scope = "default",
  series,
  period = "ALL",
  prefix = series,
  width = 6,
}: RunningNumberOptions): Promise<string> {
  const normalizedSeries = series.trim().toUpperCase();
  const normalizedPrefix = prefix.trim().toUpperCase();
  if (!scope.trim() || !normalizedSeries || !period.trim() || !normalizedPrefix) {
    throw new Error("Running number scope, series, period, and prefix are required.");
  }
  if (!Number.isInteger(width) || width < 1 || width > 12) {
    throw new Error("Running number width must be an integer from 1 to 12.");
  }

  const [sequence] = await prisma.$queryRaw<Array<{ currentValue: number }>>`
    INSERT INTO "number_sequences" ("scope", "series", "period", "current_value", "created_at", "updated_at")
    VALUES (${scope.trim()}, ${normalizedSeries}, ${period.trim()}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("scope", "series", "period") DO UPDATE
    SET "current_value" = "number_sequences"."current_value" + 1,
        "updated_at" = CURRENT_TIMESTAMP
    RETURNING "current_value" AS "currentValue"
  `;

  if (!sequence) throw new Error("Could not reserve a running number.");
  return `${normalizedPrefix}-${String(sequence.currentValue).padStart(width, "0")}`;
}
