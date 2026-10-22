"use client";

import { useState } from "react";
import { Icon } from "./icon";
import { emptyCardData, readCardFromDevice, type CardData } from "@/functions/read-card";

type Props = { compact?: boolean; onSaved?: () => void };

export default function CardReader({ compact = false, onSaved }: Props) {
  const [card, setCard] = useState<CardData>(emptyCardData);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleReadCard() {
    setBusy(true); setError(""); setMessage(""); setCard(emptyCardData);
    try {
      setCard(await readCardFromDevice());
    } catch (reason) { setError(reason instanceof Error ? reason.message : "เชื่อมต่อเครื่องอ่านบัตรไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function saveLender() {
    setSaving(true); setError(""); setMessage("");
    try {
      const { photo, ...fields } = card;
      const response = await fetch("/api/lenders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, photoData: photo, source: "ACS ACR39U" }) });
      const result = await response.json() as { lender?: { fullName: string }; message?: string };
      if (!response.ok || !result.lender) throw new Error(result.message ?? "บันทึกผู้ให้กู้ไม่สำเร็จ");
      setMessage(`บันทึก ${result.lender.fullName} ในทะเบียนผู้ให้กู้แล้ว`);
      onSaved?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึกผู้ให้กู้ไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  function update(key: keyof CardData, value: string) { setCard((current) => ({ ...current, [key]: value })); setMessage(""); }
  const field = (key: keyof CardData, label: string, editable = true) => <label key={key}>{label}<input value={card[key]} readOnly={!editable} onChange={(event) => update(key, event.target.value)} /></label>;

  return <section className={`card-reader ${compact ? "card-reader-compact" : ""}`}>
    <div className="card-reader-intro"><div className="card-reader-symbol"><Icon name="scan" size={21} /></div><div><h3>อ่านบัตรประชาชนด้วย ACS ACR39U</h3><p>เสียบบัตรเข้ากับเครื่องอ่านที่ต่อกับ Mac แล้วอ่านข้อมูลจากชิปเพื่อบันทึกเป็นผู้ให้กู้</p></div></div>
    <div className="card-reader-grid"><div className="card-reader-capture">
      <div className="card-reader-drop"><span><Icon name="card" size={22} /></span><b>เครื่องอ่านบัตร ACS ACR39U · macOS</b><small>ใช้การเชื่อมต่อ PC/SC บนเครื่องที่รันระบบนี้</small><em>เสียบบัตรประชาชนก่อนเริ่มอ่าน</em></div>
      <button type="button" className="primary-button card-reader-run" onClick={handleReadCard} disabled={busy}><Icon name={busy ? "clock" : "scan"} size={16} />{busy ? "กำลังอ่านบัตร…" : "อ่านข้อมูลจากบัตร"}</button>
      {error && <p className="card-reader-error" role="alert">{error}</p>}
      <p className="card-reader-privacy">อ่านข้อมูลและรูปถ่ายจากชิป แล้วบันทึกเมื่อกดปุ่มด้านล่าง · กรุณาตรวจทานก่อนบันทึก</p>
    </div><div className="card-reader-result"><div className="card-reader-result-head"><div><b>ข้อมูลผู้ให้กู้</b><small>ตรวจสอบและแก้ไขข้อมูลได้ก่อนบันทึก</small></div><span className={card.nationalId ? "card-reader-ready" : ""}>{card.nationalId ? "อ่านแล้ว" : "รออ่านบัตร"}</span></div>
      <div className="card-reader-photo-wrap">{card.photo ? <img className="card-reader-photo" src={`data:image/jpeg;base64,${card.photo}`} alt={`รูปถ่ายบนบัตรของ ${card.fullName || "ผู้ถือบัตร"}`} /> : <div className="card-reader-photo-placeholder"><Icon name="people" size={22} /><span>รูปถ่ายจากบัตรจะแสดงที่นี่</span></div>}<span>รูปถ่ายจากชิปบัตร</span></div>
      {field("nationalId", "เลขประจำตัวประชาชน")}{field("fullName", "ชื่อและนามสกุล")}{field("nameEn", "ชื่อภาษาอังกฤษ")}
      <div className="form-row">{field("dateOfBirth", "วันเกิด · ค.ศ.")}{field("gender", "เพศ")}</div>{field("address", "ที่อยู่")}{field("cardIssuer", "ผู้ออกบัตร")}
      <div className="form-row">{field("cardIssuedOn", "วันออกบัตร")}{field("cardExpiresOn", "วันหมดอายุ")}</div>
      {message && <p className="card-reader-saved" role="status"><Icon name="check" size={15} />{message}</p>}
      <button type="button" className="primary-button card-reader-save" onClick={saveLender} disabled={!card.fullName || !/^\d{13}$/.test(card.nationalId) || !card.photo || saving}>{saving ? "กำลังบันทึก…" : "บันทึกข้อมูลและรูปถ่าย"}</button>
    </div></div>
  </section>;
}
