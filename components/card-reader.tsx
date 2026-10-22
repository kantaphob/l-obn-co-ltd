"use client";

import { useState } from "react";
import { Icon } from "./icon";
import { useToast } from "./toast";
import { emptyCardData, readCardFromDevice, type CardData } from "@/functions/read-card";

type Props = { compact?: boolean; onSaved?: () => void };

export default function CardReader({ compact = false, onSaved }: Props) {
  const notify = useToast();
  const [card, setCard] = useState<CardData>(emptyCardData);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasReadCard, setHasReadCard] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");

  async function handleReadCard() {
    setBusy(true); setMessage("");
    try {
      setCard(await readCardFromDevice());
      setHasReadCard(true); setSaved(false);
    } catch (reason) { notify(reason instanceof Error ? reason.message : "เชื่อมต่อเครื่องอ่านบัตรไม่สำเร็จ", "error"); }
    finally { setBusy(false); }
  }

  async function saveLender() {
    setSaving(true); setMessage("");
    try {
      const { photo, ...fields } = card;
      const response = await fetch("/api/lenders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, photoData: photo, source: "ACS ACR39U" }) });
      const result = await response.json() as { lender?: { fullName: string }; message?: string };
      if (!response.ok || !result.lender) throw new Error(result.message ?? "บันทึกผู้ให้กู้ไม่สำเร็จ");
      setMessage(`บันทึก ${result.lender.fullName} ในทะเบียนผู้ให้กู้แล้ว`);
      setSaved(true);
      onSaved?.();
    } catch (reason) { notify(reason instanceof Error ? reason.message : "บันทึกผู้ให้กู้ไม่สำเร็จ", "error"); }
    finally { setSaving(false); }
  }

  function update(key: keyof CardData, value: string) { setCard((current) => ({ ...current, [key]: value })); setMessage(""); setSaved(false); }
  function clearCard() { setCard(emptyCardData); setHasReadCard(false); setSaved(false); setMessage(""); }
  const canSave = hasReadCard && !saved && Boolean(card.fullName) && /^\d{13}$/.test(card.nationalId) && Boolean(card.photo) && !saving;
  const field = (key: keyof CardData, label: string, options: { wide?: boolean; multiline?: boolean } = {}) => {
    const className = `card-reader-field${options.wide ? " card-reader-field-wide" : ""}`;
    const value = key === "address" ? card[key].replace(/#+/g, " · ").trim() : card[key];
    return <label className={className} key={key}><span>{label}</span>{options.multiline
      ? <textarea rows={3} value={value} disabled={!hasReadCard} placeholder={hasReadCard ? "กรอกที่อยู่ตามบัตร" : "อ่านบัตรเพื่อแสดงข้อมูล"} onChange={(event) => update(key, event.target.value)} />
      : <input value={value} disabled={!hasReadCard} placeholder={hasReadCard ? "—" : "อ่านบัตรเพื่อแสดงข้อมูล"} inputMode={key === "nationalId" ? "numeric" : undefined} onChange={(event) => update(key, event.target.value)} />}</label>;
  };

  return <section className={`card-reader ${compact ? "card-reader-compact" : ""}`}>
    <div className="card-reader-intro"><div className="card-reader-symbol"><Icon name="scan" size={21} /></div><div><h3>อ่านบัตรประชาชนด้วย ACS ACR39U</h3><p>เสียบบัตรเข้ากับเครื่องอ่านที่ต่อกับ Mac แล้วอ่านข้อมูลจากชิปเพื่อบันทึกเป็นผู้ให้กู้</p></div></div>
    <div className="card-reader-grid"><div className="card-reader-capture">
      <div className={`card-reader-device ${busy ? "is-reading" : hasReadCard ? "is-ready" : ""}`}>
        <div className="card-reader-device-head"><span><Icon name="card" size={20} /></span><div><b>เครื่องอ่าน ACS ACR39U</b><small>ต้องเชื่อมต่อเครื่องอ่านกับเครื่องที่รันระบบ</small></div></div>
        <div className="card-reader-device-status"><i />{busy ? "กำลังอ่านชิปบัตร" : hasReadCard ? "อ่านข้อมูลสำเร็จ" : "รอเริ่มอ่านบัตร"}</div>
        <div className="card-reader-steps"><b>วิธีใช้งาน</b><ol><li>เสียบบัตรประชาชนในเครื่องอ่าน</li><li>กดปุ่มอ่านข้อมูลด้านล่าง</li><li>ตรวจทานข้อมูล แล้วจึงบันทึก</li></ol></div>
      </div>
      <button type="button" className="primary-button card-reader-run" onClick={handleReadCard} disabled={busy}><Icon name={busy ? "clock" : "scan"} size={16} />{busy ? "กำลังอ่านบัตร…" : hasReadCard ? "อ่านบัตรอีกครั้ง" : "อ่านข้อมูลจากบัตร"}</button>
      <p className="card-reader-privacy">ข้อมูลและรูปถ่ายจะถูกบันทึกเข้าทะเบียนผู้ให้กู้เมื่อกดปุ่มบันทึกเท่านั้น</p>
    </div><div className="card-reader-result"><div className="card-reader-result-head"><div><b>ข้อมูลผู้ให้กู้</b><small>ตรวจสอบและแก้ไขข้อมูลได้ก่อนบันทึก</small></div><span className={card.nationalId ? "card-reader-ready" : ""}>{card.nationalId ? "อ่านแล้ว" : "รออ่านบัตร"}</span></div>
      <div className="card-reader-photo-wrap">{card.photo ? <img className="card-reader-photo" src={`data:image/jpeg;base64,${card.photo}`} alt={`รูปถ่ายบนบัตรของ ${card.fullName || "ผู้ถือบัตร"}`} /> : <div className="card-reader-photo-placeholder"><Icon name="people" size={22} /><span>{hasReadCard ? "ไม่พบรูปถ่าย" : "ยังไม่มีรูปถ่าย"}</span></div>}<span>{card.photo ? "รูปถ่ายจากชิปบัตร" : hasReadCard ? "ตรวจสอบการอ่านบัตรอีกครั้ง" : "รูปถ่ายจะแสดงหลังอ่านบัตร"}</span></div>
      <div className="card-reader-fields">
        {field("nationalId", "เลขประจำตัวประชาชน")}
        {field("fullName", "ชื่อและนามสกุล")}
        {field("nameEn", "ชื่อภาษาอังกฤษ")}
        {field("dateOfBirth", "วันเกิด · ค.ศ.")}
        {field("gender", "เพศ")}
        {field("address", "ที่อยู่", { wide: true, multiline: true })}
        {field("cardIssuer", "ผู้ออกบัตร")}
        {field("cardIssuedOn", "วันออกบัตร")}
        {field("cardExpiresOn", "วันหมดอายุ")}
      </div>
      {message && <p className="card-reader-saved" role="status"><Icon name="check" size={15} />{message}</p>}
      {!hasReadCard && <p className="card-reader-save-hint">อ่านบัตรก่อน เพื่อเปิดช่องข้อมูลและบันทึกผู้ให้กู้</p>}
      {hasReadCard && !canSave && <p className="card-reader-save-hint">ตรวจสอบเลขประจำตัว 13 หลัก ชื่อ และรูปถ่ายให้ครบก่อนบันทึก</p>}
      <div className="card-reader-footer-actions"><button type="button" className="primary-button card-reader-save" onClick={saveLender} disabled={!canSave}>{saving ? "กำลังบันทึก…" : saved ? "บันทึกแล้ว" : "บันทึกข้อมูลผู้ให้กู้"}</button>{hasReadCard && <button type="button" className="secondary-button card-reader-clear" onClick={clearCard} disabled={saving}>ล้างข้อมูล</button>}</div>
    </div></div>
  </section>;
}
