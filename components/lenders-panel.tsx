"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { DistrictOption, ProvinceOption, SubdistrictOption } from "../lib/thai-addresses";
import { Icon } from "./icon";

type Lender = {
  id: string; nationalId: string; fullName: string; nameEn: string | null; dateOfBirth: string | null;
  gender: string | null; address: string | null; houseNumber: string | null; soi: string | null; road: string | null;
  subdistrictCode: string | null; subdistrict: string | null; districtCode: string | null; district: string | null;
  provinceCode: string | null; province: string | null; postcode: string | null; cardIssuer: string | null;
  cardIssuedOn: string | null; cardExpiresOn: string | null; photoData: string | null; source: string; kycVerifiedAt: string | null;
  kycMethod: string | null; createdAt: string;
};
type Draft = Omit<Lender, "id" | "createdAt" | "kycVerifiedAt" | "kycMethod">;
const empty: Draft = {
  nationalId: "", fullName: "", nameEn: "", dateOfBirth: "", gender: "", address: "", houseNumber: "", soi: "", road: "",
  subdistrictCode: "", subdistrict: "", districtCode: "", district: "", provinceCode: "", province: "", postcode: "",
  cardIssuer: "", cardIssuedOn: "", cardExpiresOn: "", photoData: "", source: "manual",
};
const personalFields: Array<[keyof Draft, string]> = [["nationalId", "เลขประจำตัวประชาชน"], ["fullName", "ชื่อและนามสกุล"], ["nameEn", "ชื่อภาษาอังกฤษ"], ["dateOfBirth", "วันเกิด · ค.ศ."], ["gender", "เพศ"]];
type Options<T> = { items: T[]; message?: string };

async function getOptions<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  const result = await response.json() as Options<T>;
  if (!response.ok) throw new Error(result.message ?? "โหลดข้อมูลที่อยู่ไม่สำเร็จ");
  return result.items ?? [];
}

function partsFromCardAddress(value: string) {
  const houseNumber = value.match(/(?:เลขที่\s*)?(\d+[\d/.-]*)/)?.[1] ?? "";
  const capture = (pattern: RegExp) => value.match(pattern)?.[1]?.trim().replace(/[\s,]+$/g, "") ?? "";
  const soi = capture(/(?:ซอย|ซ\.)\s*([^,#]+?)(?=\s*(?:ถนน|ถ\.|แขวง|ตำบล|ต\.|เขต|อำเภอ|อ\.|จังหวัด|จ\.|รหัสไปรษณีย์|$))/);
  const road = capture(/(?:ถนน|ถ\.)\s*([^,#]+?)(?=\s*(?:แขวง|ตำบล|ต\.|เขต|อำเภอ|อ\.|จังหวัด|จ\.|รหัสไปรษณีย์|$))/);
  return { houseNumber, soi, road };
}

export function LendersPanel() {
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cardReading, setCardReading] = useState(false);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [subdistricts, setSubdistricts] = useState<SubdistrictOption[]>([]);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/lenders", { cache: "no-store" });
    const result = await response.json() as { lenders?: Lender[]; message?: string };
    if (!response.ok) throw new Error(result.message ?? "โหลดทะเบียนผู้ให้กู้ไม่สำเร็จ");
    setLenders(result.lenders ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/lenders", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { lenders?: Lender[]; message?: string };
      if (!response.ok) throw new Error(result.message ?? "โหลดทะเบียนผู้ให้กู้ไม่สำเร็จ");
      if (active) setLenders(result.lenders ?? []);
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ"); });
    getOptions<ProvinceOption>("/api/thai-addresses?level=provinces").then((items) => { if (active) setProvinces(items); }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "โหลดรายชื่อจังหวัดไม่สำเร็จ"); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => lenders.filter((item) => `${item.fullName} ${item.nameEn ?? ""} ${item.nationalId}`.toLowerCase().includes(query.trim().toLowerCase())), [lenders, query]);

  async function loadDistricts(provinceCode: string) {
    if (!provinceCode) { setDistricts([]); return []; }
    const items = await getOptions<DistrictOption>(`/api/thai-addresses?level=districts&provinceId=${encodeURIComponent(provinceCode)}`);
    setDistricts(items);
    return items;
  }

  async function loadSubdistricts(districtCode: string) {
    if (!districtCode) { setSubdistricts([]); return []; }
    const items = await getOptions<SubdistrictOption>(`/api/thai-addresses?level=subdistricts&districtId=${encodeURIComponent(districtCode)}`);
    setSubdistricts(items);
    return items;
  }

  function startEdit(item?: Lender) {
    setEditing(item?.id ?? null);
    setError("");
    setDistricts([]); setSubdistricts([]);
    setDraft(item ? {
      nationalId: item.nationalId, fullName: item.fullName, nameEn: item.nameEn ?? "", dateOfBirth: item.dateOfBirth ?? "", gender: item.gender ?? "",
      address: item.address ?? "", houseNumber: item.houseNumber ?? "", soi: item.soi ?? "", road: item.road ?? "",
      subdistrictCode: item.subdistrictCode ?? "", subdistrict: item.subdistrict ?? "", districtCode: item.districtCode ?? "", district: item.district ?? "",
      provinceCode: item.provinceCode ?? "", province: item.province ?? "", postcode: item.postcode ?? "", cardIssuer: item.cardIssuer ?? "",
      cardIssuedOn: item.cardIssuedOn ?? "", cardExpiresOn: item.cardExpiresOn ?? "", photoData: item.photoData ?? "", source: item.source,
    } : empty);
    setFormOpen(true);
    if (item?.provinceCode) void loadDistricts(item.provinceCode).then(() => item.districtCode ? loadSubdistricts(item.districtCode) : undefined).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "โหลดข้อมูลที่อยู่ไม่สำเร็จ"));
  }

  async function chooseProvince(provinceCode: string) {
    const province = provinces.find((item) => item.id === provinceCode);
    setDraft((value) => ({ ...value, provinceCode, province: province?.name ?? "", districtCode: "", district: "", subdistrictCode: "", subdistrict: "", postcode: "" }));
    setSubdistricts([]);
    try { await loadDistricts(provinceCode); } catch (reason) { setError(reason instanceof Error ? reason.message : "โหลดรายชื่ออำเภอไม่สำเร็จ"); }
  }

  async function chooseDistrict(districtCode: string) {
    const district = districts.find((item) => item.id === districtCode);
    setDraft((value) => ({ ...value, districtCode, district: district?.name ?? "", subdistrictCode: "", subdistrict: "", postcode: "" }));
    try { await loadSubdistricts(districtCode); } catch (reason) { setError(reason instanceof Error ? reason.message : "โหลดรายชื่อตำบลไม่สำเร็จ"); }
  }

  function chooseSubdistrict(subdistrictCode: string) {
    const subdistrict = subdistricts.find((item) => item.id === subdistrictCode);
    setDraft((value) => ({ ...value, subdistrictCode, subdistrict: subdistrict?.name ?? "", postcode: subdistrict?.postcode ?? "" }));
  }

  async function parseAddressFromCard(address: string, provincesList: ProvinceOption[]) {
    if (!address) return;
    setDistricts([]); setSubdistricts([]);
    const parts = partsFromCardAddress(address);
    let location: Partial<Draft> = {};
    const province = [...provincesList].sort((a, b) => b.name.length - a.name.length).find((item) => address.includes(item.name));
    if (province) {
      const provinceDistricts = await getOptions<DistrictOption>(`/api/thai-addresses?level=districts&provinceId=${province.id}`);
      const district = [...provinceDistricts].sort((a, b) => b.name.length - a.name.length).find((item) => address.includes(item.name));
      if (district) {
        const districtSubdistricts = await getOptions<SubdistrictOption>(`/api/thai-addresses?level=subdistricts&districtId=${district.id}`);
        const subdistrict = [...districtSubdistricts].sort((a, b) => b.name.length - a.name.length).find((item) => address.includes(item.name));
        setDistricts(provinceDistricts); setSubdistricts(districtSubdistricts);
        location = {
          provinceCode: province.id, province: province.name, districtCode: district.id, district: district.name,
          ...(subdistrict ? { subdistrictCode: subdistrict.id, subdistrict: subdistrict.name, postcode: subdistrict.postcode } : {}),
        };
      } else { setDistricts(provinceDistricts); location = { provinceCode: province.id, province: province.name }; }
    }
    setDraft((value) => ({ ...value, ...parts, provinceCode: "", province: "", districtCode: "", district: "", subdistrictCode: "", subdistrict: "", postcode: "", ...location, address }));
  }

  async function readCardIntoForm() {
    setCardReading(true); setError("");
    try {
      const response = await fetch("/api/card-reader", { method: "POST" });
      const result = await response.json() as { card?: { nationalId: string; fullName: string; nameEn: string; dateOfBirth: string; gender: string; address: string; cardIssuer: string; cardIssuedOn: string; cardExpiresOn: string; photo: string }; message?: string };
      if (!response.ok || !result.card) throw new Error(result.message ?? "อ่านบัตรไม่สำเร็จ");
      const provinceList = provinces.length ? provinces : await getOptions<ProvinceOption>("/api/thai-addresses?level=provinces");
      setProvinces(provinceList);
      const card = result.card;
      setDraft((value) => ({ ...value, nationalId: card.nationalId, fullName: card.fullName, nameEn: card.nameEn, dateOfBirth: card.dateOfBirth, gender: card.gender, cardIssuer: card.cardIssuer, cardIssuedOn: card.cardIssuedOn, cardExpiresOn: card.cardExpiresOn, photoData: card.photo, source: "ACS ACR39U" }));
      await parseAddressFromCard(card.address, provinceList);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "เชื่อมต่อเครื่องอ่านบัตรไม่สำเร็จ"); }
    finally { setCardReading(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/lenders", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, id: editing }) });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "บันทึกผู้ให้กู้ไม่สำเร็จ");
      setFormOpen(false); setEditing(null); setDraft(empty); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึกผู้ให้กู้ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function remove(item: Lender) {
    if (!window.confirm(`นำ ${item.fullName} ออกจากทะเบียนผู้ให้กู้?`)) return;
    const response = await fetch("/api/lenders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
    const result = await response.json() as { message?: string };
    if (!response.ok) setError(result.message ?? "นำผู้ให้กู้ออกไม่สำเร็จ"); else await refresh();
  }

  return <div className="module-stack lender-workspace">
    <section className="module-header panel lender-hero"><div><span className="drawer-kicker">ทะเบียนผู้ให้กู้ · ฝ่าย ACS</span><h2>จัดการข้อมูลผู้ให้กู้</h2><p>ข้อมูลผู้ให้กู้เก็บแยกจากทะเบียนผู้กู้ เพื่อใช้อ้างอิงการให้ยืม</p></div><div className="module-header-actions"><button className="primary-button" onClick={() => startEdit()}><Icon name="plus" size={16} /> เพิ่มผู้ให้กู้</button></div></section>
    <div className="summary-grid module-stats lender-stats"><article className="summary-card"><div className="card-heading">ผู้ให้กู้ทั้งหมด</div><div className="metric-value">{lenders.length}<small> คน</small></div><div className="metric-foot">แยกจากทะเบียนผู้กู้</div></article><article className="summary-card"><div className="card-heading">ผ่าน KYC ด้วย ACS</div><div className="metric-value">{lenders.filter((item) => Boolean(item.kycVerifiedAt)).length}<small> คน</small></div><div className="metric-foot">อ่านและยืนยันตัวตนจากบัตร</div></article></div>
    <section className="panel lender-records"><div className="panel-head"><div><h2>ทะเบียนผู้ให้กู้</h2><p>เลือกเพิ่มด้วยตนเองหรืออ่านบัตร ACS ซึ่งจะบันทึกสถานะ KYC</p></div></div><div className="lender-toolbar"><label className="search-field"><Icon name="search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อหรือเลขประจำตัวประชาชน" /></label><span>แสดง {visible.length} จาก {lenders.length} คน</span></div>
      {error && !formOpen && <p className="card-reader-error" role="alert">{error}</p>}
      <div className="ledger-table-wrap lender-table-wrap"><table className="ledger-table lender-table"><thead><tr><th>ผู้ให้กู้</th><th>เลขประจำตัวประชาชน</th><th>ที่อยู่</th><th>KYC</th><th>การจัดการ</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><div className="person-cell">{item.photoData ? <img className="person-avatar mint lender-avatar-photo" src={`data:image/jpeg;base64,${item.photoData}`} alt={`รูปของ ${item.fullName}`} /> : <div className="person-avatar mint">{item.fullName.replace(/\s+/g, "").slice(0, 2)}</div>}<div><b>{item.fullName}</b><small>{item.nameEn || ""}</small></div></div></td><td>{item.nationalId}</td><td>{[item.houseNumber, item.soi && `ซอย${item.soi}`, item.road && `ถนน${item.road}`, item.subdistrict && `ต.${item.subdistrict}`, item.district && `อ.${item.district}`, item.province && `จ.${item.province}`, item.postcode].filter(Boolean).join(" ") || item.address || "—"}</td><td>{item.kycVerifiedAt ? <span className="lender-kyc-verified">ผ่าน · {item.kycMethod || "ACS"}</span> : <span className="lender-kyc-pending">ยังไม่ยืนยัน</span>}</td><td><div className="member-actions"><button className="secondary-button small-button" onClick={() => startEdit(item)}>แก้ไข</button><button className="member-delete-button" onClick={() => void remove(item)}>นำออก</button></div></td></tr>)}{visible.length === 0 && <tr><td colSpan={5} className="ledger-empty">{lenders.length ? "ไม่พบผู้ให้กู้ที่ตรงกับการค้นหา" : "ยังไม่มีข้อมูลผู้ให้กู้ · เริ่มจากอ่านบัตร ACS หรือเพิ่มรายชื่อ"}</td></tr>}</tbody></table></div>
    </section>
    {formOpen && <div className="modal-backdrop" onClick={() => setFormOpen(false)}><section className="request-modal lender-form-modal" role="dialog" aria-modal="true" aria-labelledby="lender-form-title" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="drawer-kicker">ทะเบียนผู้ให้กู้</span><h2 id="lender-form-title">{editing ? "แก้ไขข้อมูลผู้ให้กู้" : "เพิ่มผู้ให้กู้"}</h2><p>อ่านข้อมูลจากบัตร ACS หรือกรอกข้อมูลด้วยตนเอง</p></div><button type="button" className="secondary-button lender-read-card" onClick={readCardIntoForm} disabled={cardReading}><Icon name={cardReading ? "clock" : "card"} size={16} />{cardReading ? "กำลังอ่านบัตร…" : "อ่านบัตรอัตโนมัติ"}</button></div><p className="lender-read-hint">เสียบบัตรประชาชนกับเครื่องอ่านที่เชื่อมต่อกับ Mac แล้วกดปุ่มนี้ ระบบจะเติมข้อมูลและรูปถ่ายจากชิปให้ตรวจทาน การอ่านผ่าน ACS จะนับเป็น KYC เมื่อบันทึก</p>
      <form onSubmit={submit}>
        <div className="lender-photo-preview">{draft.photoData ? <img src={`data:image/jpeg;base64,${draft.photoData}`} alt={`รูปถ่ายบนบัตรของ ${draft.fullName || "ผู้ถือบัตร"}`} /> : <div className="lender-photo-placeholder"><Icon name="people" size={21} /><span>รูปถ่ายจากบัตรจะแสดงที่นี่</span></div>}<span>รูปถ่ายจากชิปบัตร</span></div>
        {personalFields.map(([key, label]) => <label key={key}>{label}<input required={key === "nationalId" || key === "fullName"} inputMode={key === "nationalId" ? "numeric" : undefined} maxLength={key === "nationalId" ? 13 : undefined} value={draft[key] ?? ""} onChange={(event) => setDraft((value) => ({ ...value, [key]: event.target.value }))} /></label>)}
        <div className="lender-address-heading"><b>ที่อยู่</b><small>เลือกตำบลเพื่อเติม postcode อัตโนมัติ</small></div>
        <div className="form-row"><label>เลขที่<input value={draft.houseNumber ?? ""} onChange={(event) => setDraft((value) => ({ ...value, houseNumber: event.target.value }))} placeholder="เช่น 99/12" /></label><label>ซอย<input value={draft.soi ?? ""} onChange={(event) => setDraft((value) => ({ ...value, soi: event.target.value }))} placeholder="ชื่อซอย" /></label></div>
        <label>ถนน<input value={draft.road ?? ""} onChange={(event) => setDraft((value) => ({ ...value, road: event.target.value }))} placeholder="ชื่อถนน" /></label>
        <div className="form-row"><label>จังหวัด<select value={draft.provinceCode ?? ""} onChange={(event) => void chooseProvince(event.target.value)}><option value="">เลือกจังหวัด</option>{provinces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>อำเภอ / เขต<select value={draft.districtCode ?? ""} onChange={(event) => void chooseDistrict(event.target.value)} disabled={!draft.provinceCode}><option value="">เลือกอำเภอ / เขต</option>{districts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
        <div className="form-row"><label>ตำบล / แขวง<select value={draft.subdistrictCode ?? ""} onChange={(event) => chooseSubdistrict(event.target.value)} disabled={!draft.districtCode}><option value="">เลือกตำบล / แขวง</option>{subdistricts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>รหัสไปรษณีย์<input inputMode="numeric" maxLength={5} value={draft.postcode ?? ""} readOnly={Boolean(draft.subdistrictCode && subdistricts.find((item) => item.id === draft.subdistrictCode)?.postcode)} onChange={(event) => setDraft((value) => ({ ...value, postcode: event.target.value.replace(/\D/g, "") }))} placeholder={draft.subdistrictCode ? "กรอกรหัสไปรษณีย์" : "เลือกตำบลเพื่อเติมอัตโนมัติ"} /></label></div>
        {(draft.cardIssuer || draft.cardIssuedOn || draft.cardExpiresOn) && <details className="lender-card-details"><summary>รายละเอียดบัตร</summary><p>ผู้ออกบัตร: {draft.cardIssuer || "—"} · วันออกบัตร: {draft.cardIssuedOn || "—"} · วันหมดอายุ: {draft.cardExpiresOn || "—"}</p></details>}
        {draft.address && <details className="lender-card-details"><summary>ที่อยู่ตามข้อมูลบนชิป</summary><p>{draft.address}</p></details>}
        {draft.source === "ACS ACR39U" && <p className="lender-kyc-note"><Icon name="check" size={15} /> อ่านบัตรผ่าน ACS แล้ว · เมื่อบันทึกจะทำเครื่องหมาย KYC ผ่าน</p>}
        {error && <p className="card-reader-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>ยกเลิก</button><button className="primary-button" disabled={busy || cardReading}>{busy ? "กำลังบันทึก…" : "บันทึกผู้ให้กู้"}</button></div>
      </form>
    </section></div>}
  </div>;
}
