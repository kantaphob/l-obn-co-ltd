import { NextRequest, NextResponse } from "next/server";
import { getSessionFromToken, sessionCookie } from "../../../lib/auth";
import { getDatabase } from "../../../lib/database";

const organizationId = "org_lobn";
const noStore = { "Cache-Control": "no-store" };

type MemberInput = {
  id?: unknown;
  employeeCode?: unknown;
  name?: unknown;
  nickname?: unknown;
  phone?: unknown;
  nationalId?: unknown;
  address?: unknown;
  dateOfBirth?: unknown;
  team?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

async function authorized(request: NextRequest) {
  return Boolean(await getSessionFromToken(request.cookies.get(sessionCookie.name)?.value));
}

function getDepartmentId(team: string | null) {
  if (!team) return null;
  const database = getDatabase();
  const existing = database.prepare("SELECT id FROM departments WHERE organization_id = ? AND name = ?").get(organizationId, team);
  if (existing?.id) return String(existing.id);
  const id = `dept_${crypto.randomUUID()}`;
  database.prepare("INSERT INTO departments (id, organization_id, name) VALUES (?, ?, ?)").run(id, organizationId, team);
  return id;
}

function memberRows() {
  return getDatabase().prepare(`
    SELECT m.id, m.employee_code AS employeeCode, m.full_name AS name,
           m.nickname, m.phone, m.national_id AS nationalId,
           m.address, m.date_of_birth AS dateOfBirth,
           d.name AS team
    FROM members m
    LEFT JOIN departments d ON d.id = m.department_id
    WHERE m.organization_id = ? AND m.employment_status = 'active'
    ORDER BY m.full_name COLLATE NOCASE
  `).all(organizationId);
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  return NextResponse.json({ members: memberRows() }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: MemberInput;
  try { body = await request.json() as MemberInput; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const name = clean(body.name);
  if (!name) return NextResponse.json({ message: "กรุณาระบุชื่อสมาชิก" }, { status: 400, headers: noStore });
  const employeeCode = clean(body.employeeCode);
  try {
    const departmentId = getDepartmentId(clean(body.team));
    const id = employeeCode ?? `MB-${crypto.randomUUID()}`;
    getDatabase().prepare(`
      INSERT INTO members (id, organization_id, department_id, employee_code, full_name, nickname, phone, national_id, address, date_of_birth, employment_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(id, organizationId, departmentId, employeeCode, name, clean(body.nickname), clean(body.phone), clean(body.nationalId), clean(body.address), clean(body.dateOfBirth));
    const member = getDatabase().prepare("SELECT id, employee_code AS employeeCode, full_name AS name, nickname, phone, national_id AS nationalId, address, date_of_birth AS dateOfBirth FROM members WHERE id = ?").get(id);
    return NextResponse.json({ member }, { status: 201, headers: noStore });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("UNIQUE") ? "รหัสสมาชิกนี้ถูกใช้แล้ว" : "บันทึกสมาชิกไม่สำเร็จ";
    return NextResponse.json({ message }, { status: 409, headers: noStore });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: MemberInput;
  try { body = await request.json() as MemberInput; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const id = clean(body.id);
  const name = clean(body.name);
  if (!id || !name) return NextResponse.json({ message: "กรุณาระบุชื่อสมาชิก" }, { status: 400, headers: noStore });
  try {
    const departmentId = getDepartmentId(clean(body.team));
    const result = getDatabase().prepare(`
      UPDATE members SET department_id = ?, employee_code = ?, full_name = ?, nickname = ?, phone = ?, national_id = ?, address = ?, date_of_birth = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND organization_id = ? AND employment_status = 'active'
    `).run(departmentId, clean(body.employeeCode), name, clean(body.nickname), clean(body.phone), clean(body.nationalId), clean(body.address), clean(body.dateOfBirth), id, organizationId);
    if (!result.changes) return NextResponse.json({ message: "ไม่พบสมาชิก" }, { status: 404, headers: noStore });
    const member = getDatabase().prepare("SELECT id, employee_code AS employeeCode, full_name AS name, nickname, phone, national_id AS nationalId, address, date_of_birth AS dateOfBirth FROM members WHERE id = ?").get(id);
    return NextResponse.json({ member }, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("UNIQUE") ? "รหัสสมาชิกนี้ถูกใช้แล้ว" : "แก้ไขสมาชิกไม่สำเร็จ";
    return NextResponse.json({ message }, { status: 409, headers: noStore });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStore });
  let body: { id?: unknown };
  try { body = await request.json() as { id?: unknown }; } catch { return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers: noStore }); }
  const id = clean(body.id);
  if (!id) return NextResponse.json({ message: "ไม่พบรหัสสมาชิก" }, { status: 400, headers: noStore });
  const result = getDatabase().prepare(`
    UPDATE members SET employment_status = 'inactive', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ? AND organization_id = ? AND employment_status = 'active'
  `).run(id, organizationId);
  if (!result.changes) return NextResponse.json({ message: "ไม่พบสมาชิก" }, { status: 404, headers: noStore });
  return NextResponse.json({ ok: true }, { headers: noStore });
}
