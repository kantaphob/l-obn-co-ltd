"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Icon } from "../../../components/icon";
import { useToast } from "../../../components/toast";

type Level = "provinces" | "districts" | "subdistricts";
type AddressItem = {
  id: number;
  nameTh: string;
  nameEn: string | null;
  provinceId?: number;
  districtId?: number;
  postcode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  province?: { id: number; nameTh: string };
  district?: { id: number; nameTh: string; province?: { id: number; nameTh: string } };
  _count?: { districts?: number; subdistricts?: number };
};
type FormState = { id: string; nameTh: string; nameEn: string; parentId: string; postcode: string; latitude: string; longitude: string };

const labels: Record<Level, string> = { provinces: "จังหวัด", districts: "อำเภอ / เขต", subdistricts: "ตำบล / แขวง" };
const emptyForm: FormState = { id: "", nameTh: "", nameEn: "", parentId: "", postcode: "", latitude: "", longitude: "" };

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "ดำเนินการไม่สำเร็จ");
  return body;
}

export default function MasterdataClient() {
  const notify = useToast();
  const [level, setLevel] = useState<Level>("subdistricts");
  const [items, setItems] = useState<AddressItem[]>([]);
  const [provinces, setProvinces] = useState<AddressItem[]>([]);
  const [districts, setDistricts] = useState<AddressItem[]>([]);
  const [districtsForProvince, setDistrictsForProvince] = useState("");
  const [counts, setCounts] = useState({ provinces: 0, districts: 0, subdistricts: 0 });
  const [provinceFilter, setProvinceFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AddressItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    let active = true;
    fetch("/api/thai-addresses?level=provinces", { cache: "no-store" })
      .then((response) => readJson<{ items: Array<{ id: string; name: string }> }>(response))
      .then(({ items: rows }) => { if (active) setProvinces(rows.map((row) => ({ id: Number(row.id), nameTh: row.name, nameEn: null }))); })
      .catch((reason: unknown) => { if (active) notify(reason instanceof Error ? reason.message : "โหลดรายชื่อจังหวัดไม่สำเร็จ", "error"); });
    return () => { active = false; };
  }, [notify]);

  useEffect(() => {
    let active = true;
    if (!provinceFilter || level === "provinces") return () => { active = false; };
    fetch(`/api/admin/masterdata?level=districts&parentId=${encodeURIComponent(provinceFilter)}&pageSize=100`, { cache: "no-store" })
      .then((response) => readJson<{ items: AddressItem[] }>(response))
      .then(({ items: rows }) => { if (active) { setDistricts(rows); setDistrictsForProvince(provinceFilter); } })
      .catch((reason: unknown) => { if (active) notify(reason instanceof Error ? reason.message : "โหลดรายชื่ออำเภอไม่สำเร็จ", "error"); });
    return () => { active = false; };
  }, [provinceFilter, level, notify]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ level, page: String(page), pageSize: "8" });
    if (search.trim()) params.set("q", search.trim());
    const parentId = level === "districts" ? provinceFilter : level === "subdistricts" ? districtFilter : "";
    if (parentId) params.set("parentId", parentId);
    fetch(`/api/admin/masterdata?${params}`, { cache: "no-store" })
      .then((response) => readJson<{ items: AddressItem[]; total: number; counts: typeof counts }>(response))
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
        setCounts(result.counts);
      })
      .catch((reason: unknown) => { if (active) notify(reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ", "error"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [level, page, provinceFilter, districtFilter, search, reloadKey, notify]);

  function changeLevel(next: Level) {
    setLoading(true);
    setLevel(next);
    setPage(1);
    setSearch("");
    setProvinceFilter("");
    setDistrictFilter("");
  }

  function startCreate() {
    setEditing(null);
    setForm({ ...emptyForm, parentId: level === "districts" ? provinceFilter : level === "subdistricts" ? districtFilter : "" });
    setFormOpen(true);
  }

  function startEdit(item: AddressItem) {
    if (level === "districts" && item.provinceId) setProvinceFilter(String(item.provinceId));
    if (level === "subdistricts" && item.district) {
      setProvinceFilter(String(item.district.province?.id ?? ""));
      setDistrictFilter(String(item.districtId ?? ""));
    }
    setEditing(item);
    setForm({
      id: String(item.id), nameTh: item.nameTh, nameEn: item.nameEn ?? "",
      parentId: level === "districts" ? String(item.provinceId ?? "") : level === "subdistricts" ? String(item.districtId ?? "") : "",
      postcode: item.postcode ?? "", latitude: item.latitude == null ? "" : String(item.latitude), longitude: item.longitude == null ? "" : String(item.longitude),
    });
    setFormOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/admin/masterdata", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, ...form, id: form.id.trim() ? Number(form.id) : undefined, parentId: form.parentId ? Number(form.parentId) : undefined }),
      });
      await readJson(response);
      setFormOpen(false);
      setNotice(editing ? "บันทึกการแก้ไขแล้ว" : "เพิ่มข้อมูลแล้ว");
      setLoading(true);
      setReloadKey((value) => value + 1);
    } catch (reason) { notify(reason instanceof Error ? reason.message : "บันทึกข้อมูลไม่สำเร็จ", "error"); }
    finally { setBusy(false); }
  }

  async function remove(item: AddressItem) {
    if (!window.confirm(`ลบ${labels[level]} “${item.nameTh}” หรือไม่`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/masterdata", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, id: item.id }),
      });
      await readJson(response);
      setNotice(`ลบ${labels[level]}แล้ว`);
      setLoading(true);
      setReloadKey((value) => value + 1);
    } catch (reason) { notify(reason instanceof Error ? reason.message : "ลบข้อมูลไม่สำเร็จ", "error"); }
    finally { setBusy(false); }
  }

  const pageCount = Math.max(1, Math.ceil(total / 8));
  const parentLabel = level === "districts" ? "จังหวัด" : "อำเภอ / เขต";
  const parentOptions = level === "districts" ? provinces : districtsForProvince === provinceFilter ? districts : [];

  return <section className="module-stack masterdata-page">
    <section className="module-page panel ledger-page">
      <header className="module-header">
        <div><span className="drawer-kicker">ข้อมูลหลัก · ที่อยู่ประเทศไทย</span><h2>จัดการข้อมูลรหัสไปรษณีย์</h2><p>ดูแลจังหวัด อำเภอ/เขต ตำบล/แขวง และรหัสไปรษณีย์ที่ใช้ในแบบฟอร์มที่อยู่</p></div>
        <button className="primary-button" onClick={startCreate} disabled={busy}><Icon name="plus" size={16} /> เพิ่ม{labels[level]}</button>
      </header>

      <div className="summary-grid module-stats ledger-stats masterdata-stats">
        {(["provinces", "districts", "subdistricts"] as const).map((key) => <button key={key} className={`summary-card masterdata-stat ${level === key ? "selected" : ""}`} onClick={() => changeLevel(key)}><div className="card-heading">{labels[key]}</div><div className="metric-value">{new Intl.NumberFormat("th-TH").format(counts[key])}</div><div className="metric-foot">รายการในฐานข้อมูล</div></button>)}
      </div>

      <div className="ledger-toolbar masterdata-toolbar">
        <div className="ledger-filters" role="tablist" aria-label="ระดับข้อมูลที่อยู่">
          {(["provinces", "districts", "subdistricts"] as const).map((key) => <button role="tab" aria-selected={level === key} key={key} className={level === key ? "selected" : ""} onClick={() => changeLevel(key)}>{labels[key]}</button>)}
        </div>
        <div className="ledger-tools-right">
          {level !== "provinces" && <label className="masterdata-select"><span>จังหวัด</span><select value={provinceFilter} onChange={(event) => { setLoading(true); setProvinceFilter(event.target.value); setDistrictFilter(""); setPage(1); }}><option value="">ทุกจังหวัด</option>{provinces.map((item) => <option key={item.id} value={item.id}>{item.nameTh}</option>)}</select></label>}
          {level === "subdistricts" && <label className="masterdata-select"><span>อำเภอ / เขต</span><select value={districtFilter} onChange={(event) => { setLoading(true); setDistrictFilter(event.target.value); setPage(1); }} disabled={!provinceFilter}><option value="">ทุกอำเภอ</option>{parentOptions.map((item) => <option key={item.id} value={item.id}>{item.nameTh}</option>)}</select></label>}
          <label className="search-field"><Icon name="search" size={16} /><input value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }} placeholder="ค้นหาชื่อหรือรหัสไปรษณีย์" /></label>
        </div>
      </div>

      {notice && <div className="masterdata-notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="ปิด">×</button></div>}
      <div className="ledger-table-wrap">
        <table className="ledger-table masterdata-table">
          <thead><tr><th>รหัส</th><th>{labels[level]}</th>{level !== "provinces" && <th>จังหวัด</th>}{level === "subdistricts" && <><th>อำเภอ / เขต</th><th>รหัสไปรษณีย์</th><th>พิกัด</th></>}<th>รายการย่อย</th><th>จัดการ</th></tr></thead>
          <tbody>
            {items.map((item) => <tr key={item.id}>
              <td>{item.id}</td><td><b>{item.nameTh}</b>{item.nameEn && <small>{item.nameEn}</small>}</td>
              {level !== "provinces" && <td>{level === "districts" ? item.province?.nameTh : item.district?.province?.nameTh}</td>}
              {level === "subdistricts" && <><td>{item.district?.nameTh}</td><td>{item.postcode || "—"}</td><td>{item.latitude != null && item.longitude != null ? `${item.latitude}, ${item.longitude}` : "—"}</td></>}
              <td>{level === "provinces" ? item._count?.districts ?? 0 : level === "districts" ? item._count?.subdistricts ?? 0 : "—"}</td>
              <td><div className="member-actions"><button className="secondary-button small-button" onClick={() => startEdit(item)} disabled={busy}>แก้ไข</button><button className="member-delete-button" onClick={() => void remove(item)} disabled={busy}>ลบ</button></div></td>
            </tr>)}
            {!loading && items.length === 0 && <tr><td colSpan={level === "subdistricts" ? 8 : level === "districts" ? 5 : 4} className="ledger-empty">ไม่พบข้อมูลที่ตรงกับการค้นหา</td></tr>}
            {loading && <tr><td colSpan={level === "subdistricts" ? 8 : level === "districts" ? 5 : 4} className="ledger-empty">กำลังโหลดข้อมูล…</td></tr>}
          </tbody>
        </table>
      </div>
      <footer className="ledger-footer"><span>แสดง {items.length ? (page - 1) * 8 + 1 : 0}–{Math.min(page * 8, total)} จาก {new Intl.NumberFormat("th-TH").format(total)} รายการ</span><div className="masterdata-pagination"><button className="secondary-button small-button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>ก่อนหน้า</button><span>หน้า {page} / {pageCount}</span><button className="secondary-button small-button" disabled={page >= pageCount || loading} onClick={() => setPage((value) => value + 1)}>ถัดไป</button></div></footer>
    </section>

    {formOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}><section className="request-modal masterdata-modal" role="dialog" aria-modal="true" aria-labelledby="masterdata-form-title">
      <div className="modal-head"><div><span className="drawer-kicker">ข้อมูลหลัก · {editing ? "แก้ไขรายการ" : "เพิ่มรายการ"}</span><h2 id="masterdata-form-title">{editing ? `แก้ไข${labels[level]}` : `เพิ่ม${labels[level]}`}</h2><p>รหัสต้องไม่ซ้ำ และชื่อภาษาไทยเป็นข้อมูลบังคับ</p></div><button className="icon-button" onClick={() => setFormOpen(false)} aria-label="ปิด">×</button></div>
      <form onSubmit={save}>
        <div className="form-row"><label>รหัส<input inputMode="numeric" value={form.id} disabled={Boolean(editing)} placeholder={editing ? "รหัสข้อมูล" : "เว้นว่างให้ระบบสร้าง"} onChange={(event) => setForm((current) => ({ ...current, id: event.target.value.replace(/\D/g, "") }))} /></label><label>ชื่อภาษาไทย<input required value={form.nameTh} onChange={(event) => setForm((current) => ({ ...current, nameTh: event.target.value }))} /></label></div>
        <label>ชื่อภาษาอังกฤษ<input value={form.nameEn} onChange={(event) => setForm((current) => ({ ...current, nameEn: event.target.value }))} /></label>
        {level !== "provinces" && <label>{parentLabel}<select required value={form.parentId} onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}><option value="">เลือก{parentLabel}</option>{parentOptions.map((item) => <option key={item.id} value={item.id}>{item.nameTh}</option>)}</select></label>}
        {level === "subdistricts" && <><label>รหัสไปรษณีย์<input inputMode="numeric" maxLength={5} value={form.postcode} onChange={(event) => setForm((current) => ({ ...current, postcode: event.target.value.replace(/\D/g, "") }))} /></label><div className="form-row"><label>ละติจูด<input inputMode="decimal" value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} /></label><label>ลองจิจูด<input inputMode="decimal" value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} /></label></div></>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>ยกเลิก</button><button type="submit" className="primary-button" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button></div>
      </form>
    </section></div>}
  </section>;
}
