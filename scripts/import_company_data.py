#!/usr/bin/env python3
"""Import borrower and company-ledger CSVs into the local SQLite database."""

import argparse
import csv
import hashlib
import json
import re
import sqlite3
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORG_ID = "org_lobn"
ORG_NAME = "บริษัท ลอบน์ จำกัด"
MEMBER_COLUMNS = {
    "nickname": "TEXT",
    "national_id": "TEXT",
    "address": "TEXT",
    "date_of_birth": "TEXT",
}


def read_csv(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def clean(value):
    value = (value or "").strip()
    return value or None


def amount_satang(value):
    value = clean(value)
    if value is None:
        return 0
    try:
        return int((Decimal(value.replace(",", "")) * 100).quantize(Decimal("1")))
    except InvalidOperation as error:
        raise ValueError(f"Invalid amount in CSV: {value}") from error


def percent(value):
    value = clean(value)
    return float(value.replace("%", "")) if value else None


def import_data(borrower_path: Path, ledger_path: Path):
    database_path = ROOT / ".data" / "loans.sqlite"
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript((ROOT / "database" / "schema.sql").read_text(encoding="utf-8"))

    existing_columns = {row[1] for row in connection.execute("PRAGMA table_info(members)")}
    for name, sql_type in MEMBER_COLUMNS.items():
        if name not in existing_columns:
            connection.execute(f"ALTER TABLE members ADD COLUMN {name} {sql_type}")

    connection.execute(
        "INSERT INTO organizations (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')",
        (ORG_ID, ORG_NAME),
    )

    borrowers = read_csv(borrower_path)
    for row in borrowers:
        employee_code = clean(row.get("รหัสผู้กู้"))
        name = clean(row.get("ชื่อ"))
        if not employee_code or not name:
            continue
        national_id = clean(row.get("เลขบัตรประชาชน"))
        if national_id and "ไม่มี" in national_id:
            national_id = None
        connection.execute(
            """INSERT INTO members
               (id, organization_id, employee_code, full_name, nickname, phone,
                national_id, address, date_of_birth, note, employment_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
               ON CONFLICT(organization_id, employee_code) DO UPDATE SET
                 full_name=excluded.full_name, nickname=excluded.nickname,
                 phone=excluded.phone, national_id=excluded.national_id,
                 address=excluded.address, date_of_birth=excluded.date_of_birth,
                 note=excluded.note, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')""",
            (
                employee_code,
                ORG_ID,
                employee_code,
                name,
                clean(row.get("ชื่อเล่น")),
                clean(row.get("โทรศัพท์")),
                national_id,
                clean(row.get("ที่อยู่")),
                clean(row.get("วันเกิด")),
                clean(row.get("หมายเหตุ")),
            ),
        )

    members_by_code = {
        code: member_id
        for member_id, code in connection.execute(
            "SELECT id, employee_code FROM members WHERE organization_id = ? AND employee_code IS NOT NULL",
            (ORG_ID,),
        )
    }
    ledger_rows = read_csv(ledger_path)
    timezone_bangkok = timezone(timedelta(hours=7))
    for row in ledger_rows:
        transaction_date = clean(row.get("วันที่"))
        transaction_time = clean(row.get("เวลา"))
        if not transaction_date:
            continue
        normalized_time = transaction_time or "00:00"
        if not re.fullmatch(r"\d{1,2}:\d{2}", normalized_time):
            normalized_time = "00:00"
        local_datetime = datetime.strptime(
            f"{transaction_date} {normalized_time}", "%Y-%m-%d %H:%M"
        ).replace(tzinfo=timezone_bangkok)
        occurred_at = local_datetime.astimezone(timezone.utc).isoformat(timespec="seconds")
        related_party = clean(row.get("ผู้เกี่ยวข้อง"))
        member_match = re.search(r"\bBO\d{6}\b", related_party or "")
        member_id = members_by_code.get(member_match.group(0)) if member_match else None
        type_value = clean(row.get("ประเภท"))
        entry_type = "income" if type_value == "รายรับ" else "expense" if type_value == "รายจ่าย" else None
        if not entry_type:
            raise ValueError(f"Unknown ledger type: {type_value}")
        import_key = hashlib.sha256(
            json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        connection.execute(
            """INSERT INTO company_ledger_entries
               (id, import_key, organization_id, occurred_at, transaction_date,
                transaction_time, transaction_no, headquarters_code, branch_code,
                entry_type, description, category, member_id, related_party,
                payment_channel, reference_no, source_label, base_amount_satang,
                vat_percent, vat_amount_satang, withholding_percent,
                withholding_amount_satang, net_income_satang, net_expense_satang, note)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(import_key) DO UPDATE SET
                 occurred_at=excluded.occurred_at, transaction_date=excluded.transaction_date,
                 transaction_time=excluded.transaction_time, transaction_no=excluded.transaction_no,
                 headquarters_code=excluded.headquarters_code, branch_code=excluded.branch_code,
                 entry_type=excluded.entry_type, description=excluded.description,
                 category=excluded.category, member_id=excluded.member_id,
                 related_party=excluded.related_party, payment_channel=excluded.payment_channel,
                 reference_no=excluded.reference_no, source_label=excluded.source_label,
                 base_amount_satang=excluded.base_amount_satang, vat_percent=excluded.vat_percent,
                 vat_amount_satang=excluded.vat_amount_satang,
                 withholding_percent=excluded.withholding_percent,
                 withholding_amount_satang=excluded.withholding_amount_satang,
                 net_income_satang=excluded.net_income_satang,
                 net_expense_satang=excluded.net_expense_satang, note=excluded.note""",
            (
                f"ledger_{import_key[:24]}", import_key, ORG_ID, occurred_at,
                transaction_date, normalized_time, clean(row.get("เลขที่รายการ")),
                clean(row.get("รหัสสำนักงานใหญ่")), clean(row.get("รหัสสาขา")),
                entry_type, clean(row.get("รายการ")) or "", clean(row.get("หมวดหมู่")) or "",
                member_id, related_party, clean(row.get("ช่องทาง")), clean(row.get("เลขอ้างอิง")),
                clean(row.get("แหล่งข้อมูล")), amount_satang(row.get("ยอดฐาน (บาท)")),
                percent(row.get("VAT (%)")), amount_satang(row.get("VAT (บาท)")),
                percent(row.get("WHT (%)")), amount_satang(row.get("WHT (บาท)")),
                amount_satang(row.get("รายรับสุทธิ (บาท)")),
                amount_satang(row.get("รายจ่ายสุทธิ (บาท)")), clean(row.get("หมายเหตุ")),
            ),
        )

    connection.commit()
    member_count = connection.execute(
        "SELECT COUNT(*) FROM members WHERE organization_id = ?", (ORG_ID,)
    ).fetchone()[0]
    ledger_count = connection.execute(
        "SELECT COUNT(*) FROM company_ledger_entries WHERE organization_id = ?", (ORG_ID,)
    ).fetchone()[0]
    connection.close()
    print(f"Imported borrower records: {member_count}")
    print(f"Imported company ledger records: {ledger_count}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("borrowers", type=Path)
    parser.add_argument("company_ledger", type=Path)
    args = parser.parse_args()
    import_data(args.borrowers, args.company_ledger)
