import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "../lib/prisma";

type SqlValue = string | number | null;

function parseSqlRows(source: string, table: string, columnCount: number): SqlValue[][] {
  const insertPattern = new RegExp(`INSERT\\s+INTO\\s+${table}\\s*\\([^)]*\\)\\s*VALUES`, "gi");
  const rows: SqlValue[][] = [];
  while (insertPattern.exec(source)) {
    let index = insertPattern.lastIndex;
    while (index < source.length) {
      while (/\s|,/.test(source[index] ?? "")) index += 1;
      if (source[index] !== "(") break;
      index += 1;
      const fields: string[] = [];
      let field = "";
      let inString = false;
      while (index < source.length) {
        const char = source[index];
        if (char === "'") {
          field += char;
          if (inString && source[index + 1] === "'") {
            field += source[index + 1];
            index += 2;
            continue;
          }
          inString = !inString;
          index += 1;
          continue;
        }
        if (!inString && char === ",") {
          fields.push(field.trim());
          field = "";
          index += 1;
          continue;
        }
        if (!inString && char === ")") {
          fields.push(field.trim());
          index += 1;
          break;
        }
        field += char;
        index += 1;
      }
      if (fields.length !== columnCount) throw new Error(`Unexpected column count in ${table}: ${fields.length}`);
      rows.push(fields.map(parseLiteral));
    }
    insertPattern.lastIndex = index;
  }
  if (!rows.length) throw new Error(`No INSERT rows found for ${table}`);
  return rows;
}

function parseLiteral(raw: string): SqlValue {
  if (/^NULL$/i.test(raw)) return null;
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replaceAll("''", "'");
  const number = Number(raw);
  if (!Number.isFinite(number)) throw new Error(`Unsupported SQL value: ${raw}`);
  return number;
}

function requiredNumber(value: SqlValue, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(`Invalid ${label} in postcode source data`);
  return value;
}

function requiredText(value: SqlValue, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid ${label} in postcode source data`);
  return value;
}

function optionalText(value: SqlValue) {
  return typeof value === "string" ? value : null;
}

function optionalNumber(value: SqlValue) {
  return typeof value === "number" ? value : null;
}

async function main() {
  const inputDir = resolve(process.argv[2] ?? "");
  if (!process.argv[2]) throw new Error("Pass the folder containing province.sql.pg, district.sql.pg, and subdistrict.sql.pg");

  const [provinceSql, districtSql, subdistrictSql] = await Promise.all([
    readFile(resolve(inputDir, "province.sql.pg"), "utf8"),
    readFile(resolve(inputDir, "district.sql.pg"), "utf8"),
    readFile(resolve(inputDir, "subdistrict.sql.pg"), "utf8"),
  ]);
  const provinces = parseSqlRows(provinceSql, "province", 3).map(([id, nameTh, nameEn]) => ({
    id: requiredNumber(id, "province id"), nameTh: requiredText(nameTh, "province name"), nameEn: optionalText(nameEn),
  }));
  const districts = parseSqlRows(districtSql, "district", 4).map(([id, provinceId, nameTh, nameEn]) => ({
    id: requiredNumber(id, "district id"), provinceId: requiredNumber(provinceId, "district province id"),
    nameTh: requiredText(nameTh, "district name"), nameEn: optionalText(nameEn),
  }));
  const subdistricts = parseSqlRows(subdistrictSql, "subdistrict", 7).map(([id, districtId, nameTh, nameEn, latitude, longitude, postcode]) => ({
    id: requiredNumber(id, "subdistrict id"), districtId: requiredNumber(districtId, "subdistrict district id"),
    nameTh: requiredText(nameTh, "subdistrict name"), nameEn: optionalText(nameEn),
    latitude: optionalNumber(latitude), longitude: optionalNumber(longitude),
    postcode: postcode === null ? null : String(requiredNumber(postcode, "postcode")).padStart(5, "0"),
  }));

  await prisma.$transaction(async (transaction) => {
    await transaction.subdistrict.deleteMany();
    await transaction.district.deleteMany();
    await transaction.province.deleteMany();
    for (let index = 0; index < provinces.length; index += 100) await transaction.province.createMany({ data: provinces.slice(index, index + 100) });
    for (let index = 0; index < districts.length; index += 100) await transaction.district.createMany({ data: districts.slice(index, index + 100) });
    for (let index = 0; index < subdistricts.length; index += 100) await transaction.subdistrict.createMany({ data: subdistricts.slice(index, index + 100) });
  }, { timeout: 60_000 });

  console.log(`Imported ${provinces.length} provinces, ${districts.length} districts, and ${subdistricts.length} subdistricts.`);
}

main()
  .catch((error: unknown) => {
    console.error("Thai postcode import failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
