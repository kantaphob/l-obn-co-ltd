"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "./icon";
import CardReader from "./card-reader";
import { LendersPanel } from "./lenders-panel";
import { Sidebar, navByPath } from "./sidebar";
import { Toast, type ToastKind, type ToastMessage } from "./toast";

type CurrentUser = { username: string; displayName: string; role: string };

type LoanStatus = "รอพิจารณา" | "อนุมัติแล้ว" | "เอกสารไม่ครบ" | "ปฏิเสธ";
type Loan = {
  id: string;
  memberId?: string;
  name: string;
  initials: string;
  color: string;
  team: string;
  purpose: string;
  amount: number;
  term: number;
  date: string;
  status: LoanStatus;
  score: number;
  recorder?: string;
};

type Contract = {
  id: string;
  applicationId: string;
  name: string;
  amount: number;
  installments: number;
  monthlyPayment: number;
  annualInterestRate: number;
  signedOn: string;
  firstDueOn: string;
  repaymentMethod: string;
  status: "รอลงนาม";
};

const money = (value: number) => new Intl.NumberFormat("th-TH").format(value);
type Member = {
  id?: string;
  employeeCode?: string | null;
  name: string;
  nickname?: string | null;
  phone?: string | null;
  nationalId?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  photoData?: string | null;
  team: string;
  loans: number;
  balance: number;
  state: string;
  initials: string;
};

function MemberAvatar({ member, large = false }: { member: Member; large?: boolean }) {
  if (member.photoData) return <img className={`person-avatar mint member-avatar-photo ${large ? "large" : ""}`} src={`data:image/jpeg;base64,${member.photoData}`} alt={`รูปของ ${member.name}`} />;
  return <div className={`person-avatar mint ${large ? "large" : ""}`}>{member.initials}</div>;
}

type LedgerEntry = {
  id: string;
  date: string;
  time: string | null;
  type: "income" | "expense";
  description: string;
  category: string;
  relatedParty: string | null;
  incomeSatang: number;
  expenseSatang: number;
};

const ledgerCategories = ["รับชำระเงินกู้", "ดอกเบี้ยรับ", "เงินสนับสนุน", "เงินเดือนและค่าจ้าง", "ค่าเดินทาง", "ค่าสาธารณูปโภค", "ค่าอุปกรณ์สำนักงาน", "ค่าธรรมเนียมธนาคาร", "อื่น ๆ"];

function LedgerView({ entries, search, setSearch, onCreated, notify }: {
  entries: LedgerEntry[];
  search: string;
  setSearch: (value: string) => void;
  onCreated: (entry: LedgerEntry) => void;
  notify: (message: string) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<"income" | "expense">("income");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(ledgerCategories[0]);
  const [amount, setAmount] = useState("");
  const [relatedParty, setRelatedParty] = useState("");
  const [paymentChannel, setPaymentChannel] = useState("โอนเงิน");
  const [referenceNo, setReferenceNo] = useState("");
  const [note, setNote] = useState("");
  const income = entries.reduce((sum, entry) => sum + entry.incomeSatang, 0);
  const expense = entries.reduce((sum, entry) => sum + entry.expenseSatang, 0);
  const query = search.trim().toLocaleLowerCase("th-TH");
  const visibleEntries = entries.filter((entry) => (typeFilter === "all" || entry.type === typeFilter)
    && `${entry.description} ${entry.category} ${entry.relatedParty ?? ""}`.toLocaleLowerCase("th-TH").includes(query));

  function openEntryForm() {
    const now = new Date();
    setDate(now.toLocaleDateString("en-CA"));
    setTime(now.toTimeString().slice(0, 5));
    setShowForm(true);
  }

  function exportCsv() {
    const rows = [["วันที่", "เวลา", "ประเภท", "รายละเอียด", "หมวดหมู่", "ผู้เกี่ยวข้อง", "รายรับ", "รายจ่าย"], ...visibleEntries.map((entry) => [
      entry.date, entry.time ?? "", entry.type === "income" ? "รายรับ" : "รายจ่าย", entry.description, entry.category,
      entry.relatedParty ?? "", (entry.incomeSatang / 100).toFixed(2), (entry.expenseSatang / 100).toFixed(2),
    ])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ledger-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/accounting/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, date, time, description, category, amount: Number(amount), relatedParty, paymentChannel, referenceNo, note }),
      });
      const result = await response.json() as { entry?: LedgerEntry; message?: string };
      if (!response.ok || !result.entry) throw new Error(result.message ?? "บันทึกรายการไม่สำเร็จ");
      onCreated(result.entry);
      setShowForm(false);
      setDescription("");
      setAmount("");
      setRelatedParty("");
      setReferenceNo("");
      setNote("");
      notify("บันทึกรายการบัญชีแล้ว");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เชื่อมต่อระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return <div className="module-stack">
    <section className="module-page panel ledger-page">
      <div className="module-header"><div><span className="drawer-kicker">บัญชี · บันทึกการเงิน</span><h2>สมุดบัญชีรับ–จ่าย</h2><p>บันทึกและติดตามเงินเข้าออกของบริษัทในที่เดียว</p></div><button className="primary-button" onClick={openEntryForm}><Icon name="plus" size={16} /> เพิ่มรายการ</button></div>
      <div className="summary-grid module-stats ledger-stats">
        <article className="summary-card"><div className="card-heading">รายรับรวม</div><div className="metric-value ledger-income">฿{money(Math.round(income / 100))}</div><div className="metric-foot">{entries.filter((entry) => entry.type === "income").length} รายการรับเงิน</div></article>
        <article className="summary-card"><div className="card-heading">รายจ่ายรวม</div><div className="metric-value ledger-expense">฿{money(Math.round(expense / 100))}</div><div className="metric-foot">{entries.filter((entry) => entry.type === "expense").length} รายการจ่ายเงิน</div></article>
        <article className="summary-card"><div className="card-heading">เงินสดสุทธิ</div><div className="metric-value">฿{money(Math.round((income - expense) / 100))}</div><div className="metric-foot">คำนวณจากรายรับหักรายจ่ายทั้งหมด</div></article>
        <article className="summary-card"><div className="card-heading">รายการทั้งหมด</div><div className="metric-value">{money(entries.length)}<small> รายการ</small></div><div className="metric-foot">ข้อมูลนำเข้าและบันทึกเอง</div></article>
      </div>
      <div className="ledger-toolbar">
        <div className="ledger-filters" role="group" aria-label="กรองประเภทรายการ">
          {[{ key: "all", label: "ทั้งหมด" }, { key: "income", label: "รายรับ" }, { key: "expense", label: "รายจ่าย" }].map((filter) => <button key={filter.key} className={typeFilter === filter.key ? "selected" : ""} onClick={() => setTypeFilter(filter.key as typeof typeFilter)}>{filter.label}<span>{filter.key === "all" ? entries.length : entries.filter((entry) => entry.type === filter.key).length}</span></button>)}
        </div>
        <div className="ledger-tools-right"><label className="search-field"><Icon name="search" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหารายการ หมวดหมู่ หรือผู้เกี่ยวข้อง" /></label><button className="secondary-button ledger-export" onClick={exportCsv} disabled={visibleEntries.length === 0}><Icon name="download" size={15} /> ส่งออก CSV</button></div>
      </div>
      <div className="ledger-table-wrap"><table className="ledger-table"><thead><tr><th>วันที่ / เวลา</th><th>รายละเอียด</th><th>หมวดหมู่</th><th>ผู้เกี่ยวข้อง</th><th>รายรับ</th><th>รายจ่าย</th></tr></thead><tbody>
        {visibleEntries.map((entry) => <tr key={entry.id}><td><span className="ledger-date">{new Date(`${entry.date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</span><small>{entry.time || "—"}</small></td><td><b>{entry.description}</b><small>{entry.type === "income" ? "รับเงิน" : "จ่ายเงิน"}</small></td><td>{entry.category}</td><td>{entry.relatedParty || "—"}</td><td className="ledger-income">{entry.incomeSatang ? `฿${money(entry.incomeSatang / 100)}` : "—"}</td><td className="ledger-expense">{entry.expenseSatang ? `฿${money(entry.expenseSatang / 100)}` : "—"}</td></tr>)}
        {visibleEntries.length === 0 && <tr><td colSpan={6} className="ledger-empty">{entries.length ? "ไม่พบรายการที่ตรงกับการค้นหา" : "ยังไม่มีรายการบัญชี · เริ่มบันทึกรายรับหรือรายจ่ายรายการแรก"}</td></tr>}
      </tbody></table></div>
      <div className="ledger-footer">แสดง {visibleEntries.length} จาก {entries.length} รายการ <span>หน่วยเงิน: บาท (THB)</span></div>
    </section>
    {showForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><section className="request-modal ledger-modal" role="dialog" aria-modal="true" aria-labelledby="ledger-form-title"><div className="modal-head"><div><span className="drawer-kicker">สมุดบัญชี · รายการใหม่</span><h2 id="ledger-form-title">บันทึกรายรับหรือรายจ่าย</h2><p>ระบุรายละเอียดและจำนวนเงินให้ครบก่อนบันทึก</p></div><button className="icon-button" onClick={() => setShowForm(false)} aria-label="ปิด">×</button></div><form onSubmit={saveEntry}>
      <div className="ledger-type-switch"><button type="button" className={type === "income" ? "selected income-selected" : ""} onClick={() => { setType("income"); setCategory("รับชำระเงินกู้"); }}>＋ รับเงินเข้า</button><button type="button" className={type === "expense" ? "selected expense-selected" : ""} onClick={() => { setType("expense"); setCategory("เงินเดือนและค่าจ้าง"); }}>− จ่ายเงินออก</button></div>
      <div className="form-row"><label>วันที่<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label>เวลา<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label></div>
      <label>รายละเอียดรายการ<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={type === "income" ? "เช่น รับชำระเงินกู้ งวดที่ 3" : "เช่น ค่าอุปกรณ์สำนักงาน"} maxLength={180} required /></label>
      <div className="form-row"><label>หมวดหมู่<select value={category} onChange={(event) => setCategory(event.target.value)}>{ledgerCategories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>จำนวนเงิน (บาท)<input type="number" min="0.01" max="100000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></label></div>
      <div className="form-row"><label>ผู้เกี่ยวข้อง (ถ้ามี)<input value={relatedParty} onChange={(event) => setRelatedParty(event.target.value)} placeholder="ชื่อบุคคลหรือบริษัท" /></label><label>ช่องทางชำระ<select value={paymentChannel} onChange={(event) => setPaymentChannel(event.target.value)}><option>โอนเงิน</option><option>เงินสด</option><option>หักเงินเดือน</option><option>เช็ค</option><option>อื่น ๆ</option></select></label></div>
      <div className="form-row"><label>เลขที่อ้างอิง (ถ้ามี)<input value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} placeholder="เลขที่ใบเสร็จ / รายการ" /></label><label>หมายเหตุ (ถ้ามี)<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="บันทึกเพิ่มเติม" /></label></div>
      {error && <div className="ledger-form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>ยกเลิก</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกรายการ"}</button></div>
    </form></section></div>}
  </div>;
}

const initialRepayments: Array<{ id: string; name: string; contract: string; due: string; amount: number }> = [];

const loanFocusOptions = [
  { value: "ค่าใช้จ่ายฉุกเฉิน", title: "ค่าใช้จ่ายจำเป็น", detail: "รายจ่ายเร่งด่วนในครัวเรือน", icon: "clock" },
  { value: "ค่ารักษาพยาบาล", title: "สุขภาพ", detail: "ค่ารักษาพยาบาลและยา", icon: "plus" },
  { value: "การศึกษาบุตร", title: "การศึกษา", detail: "ค่าเล่าเรียนและอุปกรณ์", icon: "file" },
  { value: "ซ่อมแซมที่อยู่อาศัย", title: "ที่อยู่อาศัย", detail: "ซ่อมแซมและปรับปรุงบ้าน", icon: "grid" },
  { value: "อื่น ๆ", title: "อื่น ๆ", detail: "วัตถุประสงค์อื่นที่ต้องการระบุ", icon: "plus" },
];

function Status({ value }: { value: LoanStatus }) {
  const icons: Record<LoanStatus, string> = { "รอพิจารณา": "clock", "อนุมัติแล้ว": "check", "เอกสารไม่ครบ": "file", "ปฏิเสธ": "close" };
  return <span className={`status status-${value === "อนุมัติแล้ว" ? "approved" : value === "รอพิจารณา" ? "pending" : value === "เอกสารไม่ครบ" ? "incomplete" : "rejected"}`}><Icon name={icons[value]} size={13} />{value}</span>;
}

type ModuleViewProps = {
  activeNav: string;
  loans: Loan[];
  search: string;
  setSearch: (value: string) => void;
  filter: string;
  setFilter: (value: string) => void;
  onSelect: (loan: Loan) => void;
  onCreate: () => void;
  onCreateContract: () => void;
  contracts: Contract[];
  notify: (message: string) => void;
  paidRepayments: string[];
  onTogglePaid: (id: string) => void;
  members: Member[];
  onAddMember: () => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (member: Member) => void;
  companyName: string;
  setCompanyName: (value: string) => void;
  loanLimit: string;
  setLoanLimit: (value: string) => void;
  monthlyInterest: string;
  setMonthlyInterest: (value: string) => void;
  ledgerEntries: LedgerEntry[];
  onLedgerCreated: (entry: LedgerEntry) => void;
};

function ModuleView(props: ModuleViewProps) {
  const { activeNav, loans, search, setSearch, filter, setFilter, onSelect, onCreate, onCreateContract, contracts, notify, paidRepayments, onTogglePaid, members: memberRows, onAddMember, onEditMember, onDeleteMember, ledgerEntries } = props;
  const [selectedBorrower, setSelectedBorrower] = useState<Member | null>(null);
  const query = search.trim().toLowerCase();
  const visibleLoans = loans.filter((loan) => (filter === "ทั้งหมด" || loan.status === filter) && `${loan.name} ${loan.id} ${loan.purpose}`.toLowerCase().includes(query));

  if (activeNav === "ผู้ให้กู้") return <LendersPanel />;

  if (activeNav === "อ่านบัตร") return <section className="module-page panel card-reader-page"><div className="module-header"><div><span className="drawer-kicker">เครื่องมือทะเบียนผู้ให้กู้</span><h2>อ่านข้อมูลจากบัตร</h2><p>อ่านชิปบัตรประชาชนผ่านเครื่อง ACS ACR39U แล้วบันทึกเข้าทะเบียนผู้ให้กู้</p></div></div><CardReader /></section>;

  if (["คำขอกู้ยืม", "พิจารณาอนุมัติ"].includes(activeNav)) return <section className="module-page panel"><div className="module-header"><div><span className="drawer-kicker">จัดการสินเชื่อ</span><h2>{activeNav}</h2><p>ค้นหา ตรวจสอบสถานะ และเปิดรายละเอียดคำขอจากสมาชิก</p></div><button className="primary-button" onClick={onCreate}><Icon name="plus" size={17} /> สร้างคำขอ</button></div><div className="module-toolbar"><label className="search-field"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ เลขที่คำขอ หรือวัตถุประสงค์" /></label><span>ทั้งหมด {visibleLoans.length} รายการ</span></div><div className="filter-tabs module-filter-tabs">{["ทั้งหมด", "รอพิจารณา", "อนุมัติแล้ว", "เอกสารไม่ครบ", "ปฏิเสธ"].map((tab) => <button key={tab} className={filter === tab ? "selected" : ""} onClick={() => setFilter(tab)}>{tab}</button>)}</div><div className="module-list">{visibleLoans.map((loan) => <button className="module-loan-row" key={loan.id} onClick={() => onSelect(loan)}><div className={`person-avatar ${loan.color}`}>{loan.initials}</div><div className="module-loan-person"><b>{loan.name}</b><small>{loan.id} · {loan.purpose}</small></div><strong>฿{money(loan.amount)}</strong><Status value={loan.status} /><Icon name="chevron" size={17} /></button>)}{visibleLoans.length === 0 && <div className="empty-state">ไม่พบคำขอ</div>}</div></section>;

  if (["สัญญากู้ยืม", "สัญญากู้", "ตารางงวด", "ปฏิทินรับเงิน", "ค้างชำระ", "งานติดตามหนี้"].includes(activeNav)) return <div className="module-stack"><div className="module-header panel"><div><span className="drawer-kicker">การจัดการสินเชื่อ</span><h2>{activeNav}</h2><p>สร้างสัญญาจากคำขอที่อนุมัติแล้ว พร้อมระบุอัตราดอกเบี้ยตามข้อตกลง</p></div><div className="module-header-actions"><button className="primary-button" onClick={onCreateContract}><Icon name="plus" size={16} /> สร้างสัญญา</button></div></div><div className="summary-grid module-stats"><article className="summary-card"><div className="card-heading">สัญญาทั้งหมด</div><div className="metric-value">{contracts.length}<small> สัญญา</small></div></article><article className="summary-card"><div className="card-heading">เงินต้นตามสัญญา</div><div className="metric-value">฿{money(contracts.reduce((sum, item) => sum + item.amount, 0))}</div></article><article className="summary-card"><div className="card-heading">ครบกำหนด 7 วันนี้</div><div className="metric-value">{initialRepayments.length - paidRepayments.length}<small> รายการ</small></div></article><article className="summary-card"><div className="card-heading">รับชำระแล้วเดือนนี้</div><div className="metric-value">฿0</div></article></div>{contracts.length > 0 && <section className="panel module-page"><div className="panel-head"><div><h2>สัญญาที่สร้างล่าสุด</h2><p>อัตราดอกเบี้ยต่อปีและยอดชำระตามเงื่อนไขที่ตกลง</p></div></div><div className="repayment-table">{contracts.map((contract) => <div className="repayment-table-row" key={contract.id}><div className="repayment-date"><Icon name="file" size={16} /><span>{contract.id}</span></div><div className="repayment-person"><b>{contract.name}</b><small>{contract.annualInterestRate}% ต่อปี · {contract.installments} งวด · งวดแรก {new Date(`${contract.firstDueOn}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })} · {contract.repaymentMethod}</small></div><strong>฿{money(contract.monthlyPayment)}/งวด</strong><span className="status status-pending"><Icon name="clock" size={13} /> {contract.status}</span></div>)}</div></section>}<section className="panel module-page"><div className="panel-head"><div><h2>ตารางชำระที่ใกล้ถึง</h2><p>ติดตามกำหนดชำระและสถานะรายการ</p></div></div><div className="repayment-table">{initialRepayments.map((item) => { const isPaid = paidRepayments.includes(item.id); return <div className="repayment-table-row" key={item.id}><div className="repayment-date"><Icon name="clock" size={16} /><span>{item.due}</span></div><div className="repayment-person"><b>{item.name}</b><small>{item.id} · สัญญา {item.contract}</small></div><strong>฿{money(item.amount)}</strong>{isPaid ? <span className="status status-approved"><Icon name="check" size={13} /> ชำระแล้ว</span> : <button className="secondary-button small-button" onClick={() => onTogglePaid(item.id)}>บันทึกชำระแล้ว</button>}</div>; })}{initialRepayments.length === 0 && <div className="empty-state">ยังไม่มีรายการครบกำหนดในช่วงนี้</div>}</div></section></div>;

  if (["สมาชิก", "ผู้กู้", "ภาพรวมผู้กู้"].includes(activeNav)) {
    const isBorrowerView = activeNav === "ผู้กู้" || activeNav === "ภาพรวมผู้กู้";
    const visibleMembers = memberRows.filter((member) => `${member.name} ${member.team} ${member.employeeCode ?? ""} ${member.phone ?? ""} ${member.nationalId ?? ""}`.toLowerCase().includes(query));
    const borrowerLoanCount = (memberId?: string) => loans.filter((loan) => loan.memberId === memberId).length;
    const borrowerLoanTotal = (memberId?: string) => loans.filter((loan) => loan.memberId === memberId).reduce((sum, loan) => sum + loan.amount, 0);
    const selectedBorrowerLoans = selectedBorrower ? loans.filter((loan) => loan.memberId === selectedBorrower.id) : [];
    return <>
      {isBorrowerView && <div className="summary-grid module-stats borrower-stats"><article className="summary-card"><div className="card-heading">ผู้กู้ทั้งหมด</div><div className="metric-value">{memberRows.length}<small> คน</small></div><div className="metric-foot">สมาชิกที่ยังใช้งาน</div></article><article className="summary-card"><div className="card-heading">มีรายการกู้</div><div className="metric-value">{memberRows.filter((member) => borrowerLoanCount(member.id) > 0).length}<small> คน</small></div><div className="metric-foot">มีประวัติคำขอกู้ในระบบ</div></article><article className="summary-card"><div className="card-heading">คำขอกู้ทั้งหมด</div><div className="metric-value">{loans.length}<small> รายการ</small></div><div className="metric-foot">เชื่อมกับข้อมูลผู้กู้</div></article><article className="summary-card"><div className="card-heading">ยอดวงเงินที่ขอ</div><div className="metric-value">฿{money(loans.reduce((sum, loan) => sum + loan.amount, 0))}</div><div className="metric-foot">รวมทุกสถานะคำขอ</div></article></div>}
      <section className="module-page panel"><div className="module-header"><div><span className="drawer-kicker">{isBorrowerView ? "ทะเบียนผู้กู้" : "สมาชิก"}</span><h2>{isBorrowerView ? "จัดการข้อมูลผู้กู้" : "จัดการข้อมูลสมาชิก"}</h2><p>เพิ่ม ดูรายละเอียด แก้ไข หรือนำผู้กู้ออกจากรายชื่อ พร้อมข้อมูลติดต่อและประวัติคำขอ</p></div><button className="primary-button" onClick={onAddMember}><Icon name="plus" size={17} /> {isBorrowerView ? "เพิ่มผู้กู้" : "เพิ่มสมาชิก"}</button></div><div className="module-toolbar"><label className="search-field"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ รหัสสมาชิก เบอร์โทร หรือเลขบัตร" /></label><span>แสดง {visibleMembers.length} จาก {memberRows.length} คน</span></div><div className="module-list">{visibleMembers.map((member) => { const count = borrowerLoanCount(member.id); const total = borrowerLoanTotal(member.id); return <div className="member-row" key={member.id ?? member.name}><button type="button" className="borrower-open" onClick={() => setSelectedBorrower(member)}><MemberAvatar member={member} /><div className="module-loan-person"><b>{member.name}</b><small>{member.employeeCode ? `${member.employeeCode} · ` : ""}{member.nickname ? `ชื่อเล่น ${member.nickname}` : member.team || "ไม่ระบุแผนก"}{member.phone ? ` · ${member.phone}` : ""}</small></div><div className="member-metric"><small>คำขอกู้</small><b>{count} รายการ</b></div><div className="member-metric"><small>วงเงินที่ขอ</small><b>฿{money(total)}</b></div></button><div className="member-actions"><button className="secondary-button small-button" onClick={() => onEditMember(member)}>แก้ไข</button><button className="member-delete-button" onClick={() => onDeleteMember(member)}>นำออก</button></div></div>; })}{visibleMembers.length === 0 && <div className="empty-state">{memberRows.length ? "ไม่พบผู้กู้ที่ตรงกับการค้นหา" : "ยังไม่มีผู้กู้ · เพิ่มรายชื่อเพื่อเริ่มจัดการข้อมูล"}</div>}</div></section>
      {selectedBorrower && <div className="drawer-backdrop" onClick={() => setSelectedBorrower(null)}><aside className="detail-drawer borrower-drawer" role="dialog" aria-modal="true" aria-label={`รายละเอียดผู้กู้ ${selectedBorrower.name}`} onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><span className="drawer-kicker">รายละเอียดผู้กู้</span><h2>{selectedBorrower.name}</h2></div><button className="icon-button" onClick={() => setSelectedBorrower(null)} aria-label="ปิดรายละเอียด"><Icon name="close" /></button></div><div className="drawer-person"><MemberAvatar member={selectedBorrower} large /><div><b>{selectedBorrower.name}</b><small>{selectedBorrower.team || "ไม่ระบุแผนก"}</small></div></div><div className="drawer-section"><h3>ข้อมูลผู้กู้</h3><div className="detail-line"><span>รหัสสมาชิก</span><b>{selectedBorrower.employeeCode || selectedBorrower.id || "—"}</b></div><div className="detail-line"><span>ชื่อเล่น</span><b>{selectedBorrower.nickname || "—"}</b></div><div className="detail-line"><span>โทรศัพท์</span><b>{selectedBorrower.phone || "—"}</b></div><div className="detail-line"><span>เลขประจำตัวประชาชน</span><b>{selectedBorrower.nationalId || "—"}</b></div><div className="detail-line"><span>วันเกิด</span><b>{selectedBorrower.dateOfBirth || "—"}</b></div><div className="detail-line"><span>ที่อยู่</span><b>{selectedBorrower.address || "—"}</b></div></div><div className="drawer-section"><h3>ประวัติคำขอกู้ <small>({selectedBorrowerLoans.length} รายการ)</small></h3>{selectedBorrowerLoans.length ? selectedBorrowerLoans.map((loan) => <button type="button" className="borrower-loan-record" key={loan.id} onClick={() => { setSelectedBorrower(null); onSelect(loan); }}><span><b>{loan.id}</b><small>{loan.purpose} · {loan.date}</small></span><strong>฿{money(loan.amount)}</strong><Status value={loan.status} /></button>) : <div className="borrower-no-loans">ยังไม่มีประวัติคำขอกู้</div>}</div><div className="drawer-actions"><button className="secondary-button" onClick={() => { setSelectedBorrower(null); onEditMember(selectedBorrower); }}>แก้ไขข้อมูล</button><button className="primary-button" onClick={() => { setSelectedBorrower(null); onCreate(); }}>สร้างคำขอกู้</button></div></aside></div>}
    </>;
  }

  if (["รายรับรายจ่าย", "สมุดบัญชีรับ–จ่าย", "ใบแจ้งหนี้", "ลูกหนี้", "รับชำระและประวัติ", "บัญชีทุน", "กระทบยอดและปิดรอบ"].includes(activeNav)) return <LedgerView entries={ledgerEntries} search={search} setSearch={setSearch} onCreated={props.onLedgerCreated} notify={notify} />;

  if (["รายงาน", "ผลดำเนินงาน", "คาดการณ์เงินสด"].includes(activeNav)) return <div className="module-stack"><div className="module-header panel"><div><span className="drawer-kicker">วิเคราะห์ข้อมูล</span><h2>รายงานสินเชื่อ</h2><p>ภาพรวมผลการดำเนินงานประจำเดือนตุลาคม 2569</p></div><button className="secondary-button" onClick={() => { const csv = ["เลขที่คำขอ,ชื่อสมาชิก,วัตถุประสงค์,วงเงิน,สถานะ", ...loans.map((loan) => `${loan.id},${loan.name},${loan.purpose},${loan.amount},${loan.status}`)].join("\n"); const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "loan-report.csv"; link.click(); URL.revokeObjectURL(url); notify("ดาวน์โหลดรายงาน CSV แล้ว"); }}><Icon name="download" size={16} /> ส่งออกรายงาน</button></div><div className="summary-grid module-stats"><article className="summary-card"><div className="card-heading">ยอดปล่อยกู้สะสม</div><div className="metric-value">฿1,284,500</div><div className="metric-foot"><span className="trend-up">↗ 12.8%</span><span>เทียบเดือนก่อน</span></div></article><article className="summary-card"><div className="card-heading">อนุมัติในเดือนนี้</div><div className="metric-value">24<small> รายการ</small></div><div className="metric-foot">วงเงินเฉลี่ย ฿18,500</div></article><article className="summary-card"><div className="card-heading">อัตราอนุมัติ</div><div className="metric-value">82<small>%</small></div><div className="metric-foot">จากคำขอทั้งหมด</div></article><article className="summary-card"><div className="card-heading">ชำระตรงเวลา</div><div className="metric-value">96.4<small>%</small></div><div className="metric-foot"><span className="trend-up">↗ 2.4%</span><span>เทียบเดือนก่อน</span></div></article></div><section className="panel report-panel"><div className="panel-head"><div><h2>สรุปสถานะคำขอ</h2><p>อ้างอิงข้อมูลคำขอในระบบ</p></div></div>{(["รอพิจารณา", "อนุมัติแล้ว", "เอกสารไม่ครบ", "ปฏิเสธ"] as LoanStatus[]).map((status) => { const count = loans.filter((loan) => loan.status === status).length; const percent = loans.length ? Math.round(count / loans.length * 100) : 0; return <div className="report-bar-row" key={status}><span>{status}</span><div className="report-track"><span style={{ width: `${percent}%` }} /></div><b>{count}</b><small>{percent}%</small></div>; })}</section></div>;

  if (activeNav === "ตั้งค่าระบบ") return <section className="module-page panel"><div className="module-header"><div><span className="drawer-kicker">ระบบ</span><h2>ตั้งค่าระบบ</h2><p>กำหนดข้อมูลองค์กรและเงื่อนไขสินเชื่อพื้นฐาน</p></div></div><form className="settings-form" onSubmit={(event) => { event.preventDefault(); notify("บันทึกการตั้งค่าแล้ว"); }}><h3>ข้อมูลองค์กร</h3><label>ชื่อองค์กร<input value={props.companyName} onChange={(event) => props.setCompanyName(event.target.value)} required /></label><div className="form-row"><label>วงเงินกู้สูงสุดต่อคน (บาท)<input type="number" min="1000" value={props.loanLimit} onChange={(event) => props.setLoanLimit(event.target.value)} required /></label><label>อัตราดอกเบี้ยอ้างอิงต่อปี (%)<input type="number" min="0" step="0.01" value={props.monthlyInterest} onChange={(event) => props.setMonthlyInterest(event.target.value)} required /></label></div><div className="settings-note"><Icon name="check" size={16} /> เงื่อนไขนี้ใช้เป็นข้อมูลอ้างอิงในการจัดทำคำขอใหม่</div><button className="primary-button" type="submit">บันทึกการตั้งค่า</button></form></section>;

  const unavailableDetails: Record<string, string> = { "หลักประกัน": "จัดเก็บและติดตามทรัพย์สินที่ใช้เป็นหลักประกันสินเชื่อ", "บันทึกการทำงาน": "ตรวจสอบประวัติการเปลี่ยนแปลงข้อมูลและกิจกรรมของผู้ใช้", "เอกสาร": "จัดเก็บเอกสารสัญญาและเอกสารประกอบการกู้", "ถังขยะ": "เรียกคืนหรือตรวจสอบรายการที่นำออกจากระบบ" };
  return <section className="module-page panel"><div className="module-header"><div><span className="drawer-kicker">{activeNav}</span><h2>{activeNav}</h2><p>{unavailableDetails[activeNav] ?? "พื้นที่จัดการรายการในหมวดนี้"}</p></div></div><div className="empty-state module-empty"><Icon name="file" size={24} /><b>ยังไม่มีข้อมูลในหมวดนี้</b><span>เมนูพร้อมสำหรับเชื่อมต่อขั้นตอนการทำงานและข้อมูลจริง</span></div></section>;
}

export default function DashboardApp() {
  const pathname = usePathname();
  const router = useRouter();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const activeNav = navByPath[pathname] ?? "ภาพรวม";
  const headerDisplayName = currentUser?.displayName || currentUser?.username || "ผู้ดูแลระบบ";
  const headerInitials = headerDisplayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const pendingApprovalCount = loans.filter((loan) => loan.status === "รอพิจารณา").length;
  const canSearchCurrentPage = ["ภาพรวม", "ผู้ให้กู้", "ผู้กู้", "พิจารณาอนุมัติ", "รายรับรายจ่าย", "สมุดบัญชีรับ–จ่าย", "ใบแจ้งหนี้", "ลูกหนี้", "รับชำระและประวัติ", "บัญชีทุน", "กระทบยอดและปิดรอบ"].includes(activeNav);
  const [filter, setFilter] = useState("ทั้งหมด");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Loan | null>(null);
  const [modal, setModal] = useState<"loan" | "member" | "contract" | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractLoanId, setContractLoanId] = useState("LN-260415");
  const [contractAmount, setContractAmount] = useState("30000");
  const [contractInstallments, setContractInstallments] = useState("10");
  const [contractInterest, setContractInterest] = useState("0");
  const [customContractInterest, setCustomContractInterest] = useState(false);
  const [memberList, setMemberList] = useState<Member[]>([]);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberCardReading, setMemberCardReading] = useState(false);
  const [memberPhotoData, setMemberPhotoData] = useState("");
  const [memberDetailsOpen, setMemberDetailsOpen] = useState(false);
  const memberFormRef = useRef<HTMLFormElement>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loanStep, setLoanStep] = useState<1 | 2>(1);
  const [loanPurpose, setLoanPurpose] = useState("");
  const [borrowerChoice, setBorrowerChoice] = useState("new");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastSequence = useRef(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [paidRepayments, setPaidRepayments] = useState<string[]>([]);
  const [companyName, setCompanyName] = useState("บริษัท ลอบน์ จำกัด");
  const [loanLimit, setLoanLimit] = useState("50000");
  const [monthlyInterest, setMonthlyInterest] = useState("0");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => response.ok ? (await response.json() as { user: CurrentUser }).user : null)
      .then((user) => { if (active) setCurrentUser(user); })
      .catch(() => { if (active) setCurrentUser(null); });
    fetch("/api/organization-data", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as { members: Array<{ id: string; employeeCode: string | null; name: string; nickname: string | null }>; ledger: LedgerEntry[] } : null)
      .then((data) => {
        if (!active || !data) return;
        setMemberList(data.members.map((member) => ({
          id: member.id,
          employeeCode: member.employeeCode ?? undefined,
          name: member.name,
          nickname: member.nickname,
          team: "สมาชิกที่นำเข้า",
          loans: 0,
          balance: 0,
          state: "ปกติ",
          initials: member.name.replace(/\s+/g, "").slice(0, 2),
        })));
        setLedgerEntries(data.ledger);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/loans", { cache: "no-store" }),
      fetch("/api/contracts", { cache: "no-store" }),
    ]).then(async ([loanResponse, contractResponse]) => {
      const [loanData, contractData] = await Promise.all([
        loanResponse.ok ? loanResponse.json() as Promise<{ loans: Loan[] }> : null,
        contractResponse.ok ? contractResponse.json() as Promise<{ contracts: Contract[] }> : null,
      ]);
      if (!active) return;
      if (loanData) setLoans(loanData.loans);
      if (contractData) setContracts(contractData.contracts);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!["สมาชิก", "ผู้กู้", "ภาพรวมผู้กู้"].includes(activeNav)) return;
    let active = true;
    fetch("/api/members", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as { members: Member[] } : null)
      .then((data) => {
        if (!active || !data) return;
        setMemberList(data.members.map((member) => ({
          ...member,
          team: member.team ?? "",
          loans: 0,
          balance: 0,
          state: "ปกติ",
          initials: member.name.replace(/\s+/g, "").slice(0, 2),
        })));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [activeNav]);

  const filteredLoans = useMemo(() => loans.filter((loan) => {
    const matchesFilter = filter === "ทั้งหมด" || loan.status === filter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${loan.name} ${loan.id} ${loan.purpose}`.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  }), [loans, filter, search]);
  const eligibleLoans = loans.filter((loan) => loan.status === "อนุมัติแล้ว" && !contracts.some((contract) => contract.applicationId === loan.id));
  const selectedContractLoan = loans.find((loan) => loan.id === contractLoanId && loan.status === "อนุมัติแล้ว");
  const contractPreviewPayment = Number(contractInstallments) > 0
    ? (() => {
      const principal = Number(contractAmount || 0);
      const monthlyRate = Number(contractInterest || 0) / 100 / 12;
      const periods = Number(contractInstallments);
      const payment = monthlyRate === 0
        ? principal / periods
        : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -periods));
      return Math.round(payment);
    })()
    : 0;
  const totalIncomeSatang = ledgerEntries.reduce((sum, entry) => sum + entry.incomeSatang, 0);
  const totalExpenseSatang = ledgerEntries.reduce((sum, entry) => sum + entry.expenseSatang, 0);
  const expenseCategories = Object.entries(ledgerEntries.filter((entry) => entry.type === "expense").reduce<Record<string, number>>((groups, entry) => {
    groups[entry.category] = (groups[entry.category] ?? 0) + entry.expenseSatang;
    return groups;
  }, {})).sort((left, right) => right[1] - left[1]).slice(0, 5);
  const recentLedgerEntries = ledgerEntries.slice(0, 5);
  const balanceSeries = [...ledgerEntries].sort((left, right) => `${left.date} ${left.time ?? ""}`.localeCompare(`${right.date} ${right.time ?? ""}`)).slice(-12).reduce<number[]>((series, entry) => [
    ...series,
    (series.at(-1) ?? 0) + (entry.incomeSatang - entry.expenseSatang),
  ], []);
  const seriesMin = Math.min(0, ...balanceSeries);
  const seriesMax = Math.max(1, ...balanceSeries);
  const chartPoints = balanceSeries.map((value, index) => `${balanceSeries.length > 1 ? 24 + index / (balanceSeries.length - 1) * 452 : 24},${166 - ((value - seriesMin) / (seriesMax - seriesMin)) * 126}`).join(" ");
  const chartAreaPath = balanceSeries.length ? `M 24,166 L ${chartPoints.replaceAll(" ", " L ")} L 476,166 Z` : "";

  const dismissToast = useCallback((toastId: number) => {
    setToast((current) => current?.id === toastId ? null : current);
  }, []);

  function notify(message: string, kind?: ToastKind) {
    const inferredKind = kind
      ?? (/ไม่สำเร็จ|ผิดพลาด|ไม่พบ|ไม่สามารถ|เชื่อมต่อระบบไม่สำเร็จ/.test(message) ? "error"
        : /กรุณา|รอพิจารณา|ต้องตรวจสอบ/.test(message) ? "warning"
          : /บันทึก|เพิ่ม|แก้ไข|นำออก|สร้าง|อนุมัติ|ดาวน์โหลด|เรียบร้อย|สำเร็จ/.test(message) ? "success"
            : "info");
    setToast({ id: ++toastSequence.current, message, kind: inferredKind });
  }

  function startLoanRequest() {
    setLoanStep(1);
    setLoanPurpose("");
    setBorrowerChoice("new");
    setModal("loan");
  }

  async function changeStatus(id: string, status: LoanStatus) {
    try {
      const response = await fetch("/api/loans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "บันทึกสถานะคำขอไม่สำเร็จ");
      setLoans((current) => current.map((loan) => loan.id === id ? { ...loan, status } : loan));
      setSelected(null);
      notify(status === "อนุมัติแล้ว" ? "อนุมัติคำขอเรียบร้อยแล้ว" : status === "ปฏิเสธ" ? "บันทึกผลการพิจารณาแล้ว" : "ส่งคำขอกลับไปแก้ไขแล้ว");
    } catch (error) {
      notify(error instanceof Error ? error.message : "บันทึกสถานะคำขอไม่สำเร็จ");
    }
  }

  async function createLoan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const chosenMember = memberList.find((member) => (member.id ?? member.name) === borrowerChoice);
    const name = chosenMember?.name ?? String(form.get("name") ?? "").trim();
    const amount = Number(form.get("amount"));
    const term = Number(form.get("term"));
    const purpose = loanPurpose;
    if (!purpose || !name) return;
    const initials = name.replace(/\s+/g, "").slice(0, 2);
    try {
      const response = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: chosenMember?.id, memberName: chosenMember ? undefined : name, purpose, amount, installments: term, note: activeNav === "ผู้ให้กู้" ? [`ฝ่ายบันทึก: ACS`, String(form.get("note") ?? "").trim()].filter(Boolean).join(" · ") : form.get("note") }),
      });
      const result = await response.json() as { loan?: Loan; message?: string };
      if (!response.ok || !result.loan) throw new Error(result.message ?? "บันทึกคำขอกู้ยืมไม่สำเร็จ");
      setLoans((current) => [result.loan!, ...current]);
      if (!chosenMember) setMemberList((current) => [{ id: result.loan!.memberId, name, team: "สมาชิก", loans: 0, balance: 0, state: "ปกติ", initials }, ...current]);
      setModal(null);
      setFilter("ทั้งหมด");
      notify("บันทึกคำขอกู้ยืมใหม่เรียบร้อยแล้ว");
    } catch (error) {
      notify(error instanceof Error ? error.message : "บันทึกคำขอกู้ยืมไม่สำเร็จ");
    }
  }

  async function readCardIntoMemberForm() {
    setMemberCardReading(true);
    try {
      const response = await fetch("/api/card-reader", { method: "POST" });
      const result = await response.json() as { card?: { fullName: string; nationalId: string; dateOfBirth: string; address: string; photo: string }; message?: string };
      if (!response.ok || !result.card) throw new Error(result.message ?? "อ่านข้อมูลจากบัตรไม่สำเร็จ");
      const card = result.card;
      const setField = (name: string, value: string) => {
        const field = memberFormRef.current?.elements.namedItem(name);
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = value;
      };
      setField("memberName", card.fullName);
      setField("nationalId", card.nationalId);
      setField("dateOfBirth", card.dateOfBirth);
      setField("address", card.address);
      setMemberPhotoData(card.photo);
      setMemberDetailsOpen(true);
      notify("อ่านข้อมูลและรูปถ่ายจากบัตรแล้ว กรุณาตรวจทานก่อนบันทึก");
    } catch (error) {
      notify(error instanceof Error ? error.message : "อ่านข้อมูลจากบัตรไม่สำเร็จ");
    } finally {
      setMemberCardReading(false);
    }
  }

  async function createMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("memberName") ?? "").trim();
    const team = String(form.get("team") ?? "").trim();
    const payload = {
      id: editingMember?.id,
      employeeCode: String(form.get("employeeCode") ?? "").trim(),
      name,
      team,
      nickname: String(form.get("nickname") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      nationalId: String(form.get("nationalId") ?? "").trim(),
      address: String(form.get("address") ?? "").trim(),
      dateOfBirth: String(form.get("dateOfBirth") ?? "").trim(),
      photoData: String(form.get("photoData") ?? "").trim(),
    };
    try {
      const response = await fetch("/api/members", {
        method: editingMember ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { member?: Partial<Member>; message?: string };
      if (!response.ok || !result.member) throw new Error(result.message ?? "บันทึกสมาชิกไม่สำเร็จ");
      const savedMember: Member = {
        ...result.member,
        id: String(result.member.id ?? editingMember?.id ?? ""),
        name,
        photoData: result.member.photoData ?? memberPhotoData,
        team,
        loans: editingMember?.loans ?? 0,
        balance: editingMember?.balance ?? 0,
        state: "ปกติ",
        initials: name.replace(/\s+/g, "").slice(0, 2),
      };
      setMemberList((current) => editingMember
        ? current.map((member) => member.id === editingMember.id ? savedMember : member)
        : [savedMember, ...current]);
      setModal(null);
      setEditingMember(null);
      setSearch("");
      notify(editingMember ? "บันทึกการแก้ไขสมาชิกแล้ว" : "เพิ่มสมาชิกใหม่เรียบร้อยแล้ว");
    } catch (error) {
      notify(error instanceof Error ? error.message : "บันทึกสมาชิกไม่สำเร็จ");
    }
  }

  async function deleteMember(member: Member) {
    if (!member.id) {
      setMemberList((current) => current.filter((item) => item !== member));
      notify("นำสมาชิกออกจากรายชื่อแล้ว");
      return;
    }
    if (!window.confirm(`นำ ${member.name} ออกจากรายชื่อสมาชิก?`)) return;
    try {
      const response = await fetch("/api/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "นำสมาชิกออกไม่สำเร็จ");
      setMemberList((current) => current.filter((item) => item.id !== member.id));
      notify("นำสมาชิกออกจากรายชื่อแล้ว");
    } catch (error) {
      notify(error instanceof Error ? error.message : "นำสมาชิกออกไม่สำเร็จ");
    }
  }

  async function createContract(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const loan = loans.find((item) => item.id === contractLoanId && item.status === "อนุมัติแล้ว");
    if (!loan || contracts.some((contract) => contract.applicationId === loan.id)) {
      notify("เลือกคำขอที่อนุมัติแล้วและยังไม่มีสัญญา");
      return;
    }
    const amount = Number(contractAmount);
    const installments = Number(contractInstallments);
    const interest = Number(contractInterest);
    if (amount <= 0 || installments <= 0 || interest < 0) return;
    try {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: loan.id, amount, installments, annualInterestRate: interest, firstDueOn: form.get("firstDueOn"), repaymentMethod: form.get("repaymentMethod") }),
      });
      const result = await response.json() as { contract?: Contract; message?: string };
      if (!response.ok || !result.contract) throw new Error(result.message ?? "บันทึกสัญญาไม่สำเร็จ");
      setContracts((current) => [result.contract!, ...current]);
      setModal(null);
      notify(`สร้างสัญญา ${result.contract.id} แล้ว · รอลงนาม`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "บันทึกสัญญาไม่สำเร็จ");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <main className="app-shell">
      <Sidebar
        activeNav={activeNav}
        currentUser={currentUser}
        companyName={companyName}
        mobileMenu={mobileMenu}
        pendingApprovalCount={pendingApprovalCount}
        onCloseMobileMenu={() => setMobileMenu(false)}
        onNavigate={() => { setSearch(""); setMobileMenu(false); }}
        onLogout={logout}
        onNotify={notify}
      />
      {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="ปิดเมนู" />}

      <section className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileMenu(true)} aria-label="เปิดเมนู"><Icon name="menu" /></button>
          <div className="topbar-heading">
            <div className="breadcrumb"><b>{activeNav}</b></div>
            <span className="topbar-context">{activeNav === "ภาพรวม" ? "ภาพรวมสินเชื่อและการเงิน" : `จัดการ${activeNav}ขององค์กร`}</span>
          </div>
          {canSearchCurrentPage && <div className="global-search">
            <Icon name="search" size={17} />
            <input aria-label="ค้นหาในหน้าปัจจุบัน" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาในหน้านี้..." />
            {search && <button type="button" className="search-clear" onClick={() => setSearch("")} aria-label="ล้างคำค้น"><Icon name="close" size={14} /></button>}
          </div>}
          <div className="top-actions">
            <button className="icon-button notification-button" aria-label={`เปิดคำขอรอพิจารณา ${pendingApprovalCount} รายการ`} title="ไปยังคำขอรอพิจารณา" onClick={() => router.push("/loans/review")}>
              <Icon name="bell" />
              {pendingApprovalCount > 0 && <span className="notification-count">{pendingApprovalCount > 9 ? "9+" : pendingApprovalCount}</span>}
            </button>
            <button className="top-account" onClick={() => router.push("/settings")} title="ไปที่ตั้งค่าระบบ" aria-label={`บัญชี ${headerDisplayName} ไปที่ตั้งค่าระบบ`}>
              <span className="top-user">{headerInitials || "A"}</span>
              <span className="top-account-copy"><b>{headerDisplayName}</b><small>{currentUser?.username ? `@${currentUser.username} · ` : ""}{currentUser?.role === "admin" ? "ผู้ดูแลระบบ" : "บัญชีผู้ใช้"}</small></span>
              <Icon name="chevron-down" size={15} />
            </button>
          </div>
        </header>

        <div className="content-wrap">
          <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> {activeNav === "ภาพรวม" ? "วันทำงานที่ดี เริ่มจากใจที่สบาย" : "จัดการงานตามหมวดหมู่"}</div><h1>{activeNav === "ภาพรวม" ? <>สวัสดี, {currentUser?.displayName ?? currentUser?.username ?? "ผู้ดูแลระบบ"} <span className="wave">✦</span></> : activeNav}</h1><p className="welcome-sub">{activeNav === "ภาพรวม" ? "จัดการสินเชื่อและดูแลสมาชิกของคุณได้ในที่เดียว" : `พื้นที่${activeNav} · ข้อมูลองค์กร ${companyName}`}</p></div>{activeNav === "ภาพรวม" && <button className="primary-button" onClick={startLoanRequest}><Icon name="plus" size={18} /> สร้างคำขอกู้ยืม</button>}</div>

          {activeNav === "ภาพรวม" ? <>
          <div className="summary-grid">
            <article className="summary-card"><div className="card-heading"><span>ผู้กู้ในระบบ</span><span className="metric-icon green"><Icon name="people" /></span></div><div className="metric-value">{memberList.length}<small> คน</small></div><div className="metric-foot"><span className="trend-up">ข้อมูลผู้กู้</span><span>จากฐานข้อมูลบริษัท</span></div><div className="sparkline spark-green"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div></article>
            <article className="summary-card"><div className="card-heading"><span>คำขอรอพิจารณา</span><span className="metric-icon orange"><Icon name="clock" /></span></div><div className="metric-value">{loans.filter((loan) => loan.status === "รอพิจารณา").length}<small> รายการ</small></div><div className="metric-foot"><span className="trend-note">รอตรวจสอบ</span><span>คำขอสินเชื่อ</span></div><div className="sparkline spark-orange"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div></article>
            <article className="summary-card"><div className="card-heading"><span>รายรับบริษัท</span><span className="metric-icon blue"><Icon name="arrow" /></span></div><div className="metric-value">฿{money(Math.round(totalIncomeSatang / 100))}</div><div className="metric-foot"><span className="trend-up">รายรับสุทธิ</span><span>{ledgerEntries.length} รายการบัญชี</span></div><div className="sparkline spark-blue"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div></article>
            <article className="summary-card"><div className="card-heading"><span>รายจ่ายบริษัท</span><span className="metric-icon purple"><Icon name="wallet" /></span></div><div className="metric-value">฿{money(Math.round(totalExpenseSatang / 100))}</div><div className="metric-foot"><span className="trend-note">รายจ่ายสุทธิ</span><span>จากไฟล์บัญชี</span></div><div className="sparkline spark-purple"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div></article>
            <article className="summary-card"><div className="card-heading"><span>เงินสดสุทธิ</span><span className="metric-icon teal"><Icon name="chart" /></span></div><div className="metric-value">฿{money(Math.round((totalIncomeSatang - totalExpenseSatang) / 100))}</div><div className="metric-foot"><span className="trend-up">รับลบจ่าย</span><span>ยอดสุทธิตามข้อมูล</span></div><div className="sparkline spark-teal"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div></article>
          </div>

          <div className="finance-grid">
            <section className="panel balance-chart-panel"><div className="panel-head"><div><h2>ภาพรวมกระแสเงินสด</h2><p>ยอดสะสมสุทธิจากรายการบัญชีที่นำเข้า</p></div><button className="chart-period" type="button">ทั้งหมด <span>⌄</span></button></div><div className="chart-total"><b>฿{money(Math.round((totalIncomeSatang - totalExpenseSatang) / 100))}</b><span className="trend-up">↗ สุทธิ</span><small>รายรับ ฿{money(Math.round(totalIncomeSatang / 100))} · รายจ่าย ฿{money(Math.round(totalExpenseSatang / 100))}</small></div><div className="balance-chart"><div className="chart-y-labels"><span>฿{money(Math.round(seriesMax / 100))}</span><span>฿{money(Math.round((seriesMax + seriesMin) / 200))}</span><span>฿{money(Math.round(seriesMin / 100))}</span></div><svg viewBox="0 0 500 190" role="img" aria-label="กราฟกระแสเงินสดสะสม"><defs><linearGradient id="balanceFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#39b5ad" stopOpacity=".28"/><stop offset="100%" stopColor="#39b5ad" stopOpacity="0"/></linearGradient></defs><path d={chartAreaPath} fill="url(#balanceFill)"/><polyline points={chartPoints} fill="none" stroke="#199d9c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{balanceSeries.length > 0 && <circle cx={balanceSeries.length > 1 ? 24 + (balanceSeries.length - 1) / (balanceSeries.length - 1) * 452 : 24} cy={166 - ((balanceSeries.at(-1)! - seriesMin) / (seriesMax - seriesMin)) * 126} r="5" fill="#fff" stroke="#159e9b" strokeWidth="3"/>}</svg></div><div className="chart-x-labels">{ledgerEntries.length ? [ledgerEntries.at(-1)?.date, ledgerEntries[Math.floor(ledgerEntries.length / 2)]?.date, ledgerEntries[0]?.date].filter(Boolean).map((date) => <span key={date}>{new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>) : <span>ยังไม่มีข้อมูล</span>}</div></section>
            <section className="panel category-panel"><div className="panel-head"><div><h2>รายจ่ายตามหมวด</h2><p>แยกตามรายการจากบัญชีบริษัท</p></div></div><div className="donut-layout"><div className="expense-donut" style={{ background: `conic-gradient(${expenseCategories.length ? expenseCategories.map(([, value], index) => { const colors = ["#19a6a2", "#51c7bd", "#76a7eb", "#8a7de0", "#c0e7df"]; const before = expenseCategories.slice(0, index).reduce((sum, item) => sum + item[1], 0) / Math.max(1, totalExpenseSatang) * 100; const after = before + value / Math.max(1, totalExpenseSatang) * 100; return `${colors[index % colors.length]} ${before}% ${after}%`; }).join(",") : "#dce9ed 0 100%"})` }}><div><b>฿{money(Math.round(totalExpenseSatang / 100))}</b><small>รายจ่ายสุทธิ</small></div></div><div className="category-legend">{expenseCategories.map(([category, value], index) => { const percent = Math.round(value / Math.max(1, totalExpenseSatang) * 100); return <div className="category-legend-row" key={category}><i className={`legend-dot color-${index}`} /><span><b>{category}</b><small>฿{money(Math.round(value / 100))}</small></span><em>{percent}%</em></div>; })}{expenseCategories.length === 0 && <span className="empty-hint">ยังไม่มีรายการรายจ่าย</span>}</div></div></section>
            <section className="panel recent-transactions-panel"><div className="panel-head"><div><h2>รายการล่าสุด</h2><p>อัปเดตจากบัญชีบริษัท</p></div><button className="text-button" onClick={() => router.push("/accounting/ledger")}>ดูทั้งหมด <Icon name="arrow" size={15} /></button></div><div className="recent-transactions">{recentLedgerEntries.map((entry, index) => <div className="transaction-row" key={entry.id}><span className={`transaction-icon transaction-${index % 4}`}><Icon name={entry.type === "income" ? "arrow" : "wallet"} size={16} /></span><span className="transaction-copy"><b>{entry.description}</b><small>{new Date(`${entry.date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" })} · {entry.category}</small></span><strong className={entry.type === "income" ? "income-amount" : "expense-amount"}>{entry.type === "income" ? "+" : "−"}฿{money(Math.round((entry.type === "income" ? entry.incomeSatang : entry.expenseSatang) / 100))}</strong></div>)}{recentLedgerEntries.length === 0 && <div className="empty-state">ยังไม่มีรายการบัญชี</div>}</div></section>
          </div>

          <div className="overview-grid">
            <section className="panel loan-panel">
              <div className="panel-head"><div><h2>คำขอกู้ยืมล่าสุด</h2><p>ติดตามและจัดการคำขอจากสมาชิก</p></div><button className="text-button" onClick={() => { router.push("/loans/review"); setFilter("ทั้งหมด"); }}>ดูคำขอทั้งหมด <Icon name="arrow" size={16} /></button></div>
              <div className="table-tools"><div className="filter-tabs">{["ทั้งหมด", "รอพิจารณา", "อนุมัติแล้ว", "เอกสารไม่ครบ"].map((tab) => <button key={tab} className={filter === tab ? "selected" : ""} onClick={() => setFilter(tab)}>{tab}{tab === "รอพิจารณา" && <span>{loans.filter((loan) => loan.status === tab).length}</span>}</button>)}</div><label className="search-field"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อหรือเลขที่คำขอ" /></label></div>
              <div className="table-scroll"><table><thead><tr><th>ผู้ยื่นคำขอ</th><th>วัตถุประสงค์</th><th>วงเงิน</th><th>วันที่ยื่น</th><th>สถานะ</th><th aria-label="ดูรายละเอียด" /></tr></thead><tbody>{filteredLoans.slice(0, 5).map((loan) => <tr key={loan.id} onClick={() => setSelected(loan)}><td><div className="person-cell"><div className={`person-avatar ${loan.color}`}>{loan.initials}</div><div><b>{loan.name}</b><small>{loan.id}</small></div></div></td><td><div className="purpose-cell">{loan.purpose}<small>{loan.term} งวด</small></div></td><td className="amount-cell">฿{money(loan.amount)}</td><td className="date-cell">{loan.date}</td><td><Status value={loan.status} /></td><td><button className="row-arrow" aria-label={`ดูคำขอ ${loan.id}`}><Icon name="chevron" size={17} /></button></td></tr>)}</tbody></table>{filteredLoans.length === 0 && <div className="empty-state">ไม่พบคำขอที่ตรงกับการค้นหา</div>}</div>
              <div className="table-footer"><span>แสดง {filteredLoans.length ? 1 : 0}–{Math.min(filteredLoans.length, 5)} จาก {filteredLoans.length} รายการ</span><div className="pagination"><button disabled aria-label="หน้าก่อนหน้า">‹</button><button className="page-current">1</button><button disabled aria-label="หน้าถัดไป">›</button></div></div>
            </section>

            <aside className="right-column">
              <section className="panel action-panel"><div className="panel-head compact"><div><h2>สิ่งที่ต้องทำ</h2><p>รายการที่ต้องติดตามวันนี้</p></div><span className="count-badge">{loans.filter((loan) => loan.status === "รอพิจารณา").length + 3}</span></div><div className="action-list"><button className="action-row" onClick={() => { setFilter("รอพิจารณา"); router.push("/loans/review"); }}><span className="action-icon amber"><Icon name="file" size={17} /></span><span><b>พิจารณาคำขอกู้ยืม</b><small>มี {loans.filter((loan) => loan.status === "รอพิจารณา").length} คำขอรออนุมัติ</small></span><strong>{loans.filter((loan) => loan.status === "รอพิจารณา").length}</strong></button><button className="action-row" onClick={() => notify("มีรายการชำระครบกำหนดวันนี้ 2 รายการ")}><span className="action-icon rose"><Icon name="clock" size={17} /></span><span><b>ติดตามการชำระเงิน</b><small>ครบกำหนดชำระวันนี้</small></span><strong>2</strong></button><button className="action-row" onClick={() => { setFilter("เอกสารไม่ครบ"); router.push("/loans/review"); }}><span className="action-icon lavender-bg"><Icon name="file" size={17} /></span><span><b>ตรวจสอบเอกสาร</b><small>รอสมาชิกส่งเอกสารเพิ่ม</small></span><strong>{loans.filter((loan) => loan.status === "เอกสารไม่ครบ").length}</strong></button></div><button className="action-link" onClick={() => notify("แสดงรายการติดตามทั้งหมด")}>ดูรายการทั้งหมด <Icon name="arrow" size={15} /></button></section>
              <section className="panel repayment-panel"><div className="panel-head compact"><div><h2>กำหนดชำระใกล้ถึง</h2><p>รายการใน 7 วันข้างหน้า</p></div><button className="more-button" onClick={() => notify("เปิดปฏิทินกำหนดชำระ")}>•••</button></div><div className="repayment-list"><div className="repayment-row"><div className="date-tile"><b>22</b><small>ต.ค.</small></div><div className="repayment-person"><b>อรทัย จันทร์เพ็ญ</b><small>งวดที่ 4 จาก 10</small></div><strong>฿2,500</strong></div><div className="repayment-row"><div className="date-tile"><b>24</b><small>ต.ค.</small></div><div className="repayment-person"><b>ปรีชา ศรีสวัสดิ์</b><small>งวดที่ 2 จาก 6</small></div><strong>฿3,000</strong></div></div><button className="calendar-link" onClick={() => notify("เปิดตารางกำหนดชำระทั้งหมด")}>ดูตารางชำระทั้งหมด <Icon name="arrow" size={15} /></button></section>
            </aside>
          </div>

          <div className="bottom-note"><span className="note-spark">✳</span><div><b>สินเชื่อที่ดี เริ่มต้นจากความเข้าใจ</b><span>ทุกคำขอได้รับการพิจารณาอย่างเป็นธรรมและโปร่งใส</span></div><button onClick={() => notify("เปิดคู่มือแนวทางการพิจารณาสินเชื่อ")}>แนวทางการพิจารณา <Icon name="arrow" size={15} /></button><div className="note-decoration">ใจดี</div></div>
          </> : <ModuleView activeNav={activeNav} loans={loans} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} onSelect={setSelected} onCreate={startLoanRequest} onCreateContract={() => { const nextLoan = loans.find((loan) => loan.status === "อนุมัติแล้ว" && !contracts.some((contract) => contract.applicationId === loan.id)); if (nextLoan) { setContractLoanId(nextLoan.id); setContractAmount(String(nextLoan.amount)); setContractInstallments(String(nextLoan.term)); } setContractInterest(monthlyInterest); setCustomContractInterest(false); setModal("contract"); }} contracts={contracts} onAddMember={() => { setEditingMember(null); setMemberPhotoData(""); setMemberDetailsOpen(false); setModal("member"); }} onEditMember={(member) => { setEditingMember(member); setMemberPhotoData(member.photoData ?? ""); setMemberDetailsOpen(Boolean(member.nationalId || member.dateOfBirth || member.address)); setModal("member"); }} onDeleteMember={deleteMember} members={memberList} notify={notify} paidRepayments={paidRepayments} onTogglePaid={(id) => setPaidRepayments((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} companyName={companyName} setCompanyName={setCompanyName} loanLimit={loanLimit} setLoanLimit={setLoanLimit} monthlyInterest={monthlyInterest} setMonthlyInterest={setMonthlyInterest} ledgerEntries={ledgerEntries} onLedgerCreated={(entry) => setLedgerEntries((current) => [entry, ...current])} />}
          <footer className="footer"><span>© 2569 ใจดี · ระบบจัดการสินเชื่อสำหรับองค์กร</span><span>ข้อมูลอัปเดตล่าสุด 09:42 น.</span></footer>
        </div>
      </section>

      {selected && <div className="drawer-backdrop" onClick={() => setSelected(null)}><aside className="detail-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><span className="drawer-kicker">รายละเอียดคำขอ</span><h2>{selected.id}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="ปิดรายละเอียด"><Icon name="close" /></button></div><div className="drawer-person"><div className={`person-avatar large ${selected.color}`}>{selected.initials}</div><div><b>{selected.name}</b><small>{selected.team}</small></div></div><Status value={selected.status} /><div className="drawer-section"><h3>ข้อมูลคำขอ</h3><div className="detail-line"><span>วัตถุประสงค์</span><b>{selected.purpose}</b></div><div className="detail-line"><span>วงเงินที่ขอ</span><b>฿{money(selected.amount)}</b></div><div className="detail-line"><span>ระยะเวลาผ่อน</span><b>{selected.term} งวด</b></div><div className="detail-line"><span>วันที่ยื่นคำขอ</span><b>{selected.date}</b></div></div><div className="score-card"><div><span>คะแนนความพร้อม</span><b>{selected.score}<small>/100</small></b></div><div className="score-track"><span style={{ width: `${selected.score}%` }} /></div><small>ประเมินจากอายุงาน ประวัติชำระ และภาระหนี้</small></div><div className="drawer-section"><h3>เอกสารประกอบ</h3><div className="document-row"><span className="doc-icon"><Icon name="file" size={17} /></span><span><b>แบบฟอร์มคำขอกู้ยืม.pdf</b><small>อัปโหลด 18 ต.ค. 2569</small></span><button aria-label="ดาวน์โหลด"><Icon name="download" size={17} /></button></div><div className="document-row"><span className="doc-icon"><Icon name="file" size={17} /></span><span><b>สลิปเงินเดือนล่าสุด.pdf</b><small>อัปโหลด 18 ต.ค. 2569</small></span><button aria-label="ดาวน์โหลด"><Icon name="download" size={17} /></button></div></div><div className="drawer-actions"><button className="secondary-button" onClick={() => changeStatus(selected.id, "เอกสารไม่ครบ")}>ขอเอกสารเพิ่ม</button><button className="primary-button" onClick={() => changeStatus(selected.id, "อนุมัติแล้ว")}><Icon name="check" size={17} /> อนุมัติคำขอ</button></div></aside></div>}

      {modal === "loan" && <div className="modal-backdrop" onClick={() => setModal(null)}><div className="request-modal loan-request-modal" role="dialog" aria-modal="true" aria-labelledby="loan-title" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="drawer-kicker">สร้างรายการใหม่ · ขั้นตอน {loanStep} จาก 2</span><h2 id="loan-title">สร้างคำขอกู้ยืม</h2><p>{loanStep === 1 ? "เลือกวัตถุประสงค์เพื่อจัดหมวดคำขอ" : "เลือกผู้กู้หรือเพิ่มชื่อใหม่ แล้วระบุวงเงิน"}</p></div><button className="icon-button" onClick={() => setModal(null)} aria-label="ปิด"><Icon name="close" /></button></div><div className="loan-step-track"><span className={loanStep === 1 ? "active" : "complete"}>01 <b>วัตถุประสงค์</b></span><i /><span className={loanStep === 2 ? "active" : ""}>02 <b>ข้อมูลผู้กู้</b></span></div>{loanStep === 1 ? <div className="loan-focus-grid">{loanFocusOptions.map((option) => <button type="button" className={`loan-focus-option ${loanPurpose === option.value ? "selected" : ""}`} key={option.value} onClick={() => setLoanPurpose(option.value)}><span className="loan-focus-icon"><Icon name={option.icon} size={19} /></span><span><b>{option.title}</b><small>{option.detail}</small></span>{loanPurpose === option.value && <span className="loan-focus-check"><Icon name="check" size={15} /></span>}</button>)}<div className="loan-purpose-selected">{loanPurpose ? <>เลือกแล้ว: <b>{loanPurpose}</b></> : "เลือกหนึ่งรายการเพื่อดำเนินการต่อ"}</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>ยกเลิก</button><button type="button" className="primary-button" disabled={!loanPurpose} onClick={() => setLoanStep(2)}>ถัดไป: เลือกผู้กู้ <Icon name="arrow" size={16} /></button></div></div> : <form onSubmit={createLoan}><div className="loan-borrower-switch"><button type="button" className={borrowerChoice === "new" ? "selected" : ""} onClick={() => setBorrowerChoice("new")}><Icon name="plus" size={16} /> เพิ่มชื่อผู้กู้</button><button type="button" className={borrowerChoice !== "new" ? "selected" : ""} onClick={() => { if (memberList.length) setBorrowerChoice(memberList[0].id ?? memberList[0].name); }} disabled={!memberList.length}><Icon name="people" size={16} /> เลือกสมาชิกเดิม</button></div>{borrowerChoice === "new" ? <label>ชื่อผู้กู้<input name="name" required placeholder="ระบุชื่อและนามสกุล" /></label> : <label>เลือกผู้กู้<select value={borrowerChoice} onChange={(event) => setBorrowerChoice(event.target.value)}>{memberList.map((member) => <option key={member.id ?? member.name} value={member.id ?? member.name}>{member.name}{member.employeeCode ? ` · ${member.employeeCode}` : ""}</option>)}</select></label>}<div className="loan-purpose-summary"><span className="loan-focus-icon"><Icon name="check" size={17} /></span><span><small>วัตถุประสงค์ที่เลือก</small><b>{loanPurpose}</b></span><button type="button" onClick={() => setLoanStep(1)}>แก้ไข</button></div><div className="form-row"><label>วงเงินที่ต้องการ (บาท)<input name="amount" required type="number" min="1000" max={loanLimit} placeholder="10,000" /><small>วงเงินสูงสุด ฿{money(Number(loanLimit))}</small></label><label>จำนวนงวด<select name="term" defaultValue="6"><option value="3">3 งวด</option><option value="6">6 งวด</option><option value="10">10 งวด</option><option value="12">12 งวด</option></select></label></div><label>หมายเหตุ<textarea name="note" rows={3} placeholder="รายละเอียดเพิ่มเติม เช่น รายการค่าใช้จ่าย" /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setLoanStep(1)}>ย้อนกลับ</button><button type="submit" className="primary-button">บันทึกคำขอ <Icon name="arrow" size={16} /></button></div></form>}</div></div>}
      {modal === "contract" && <div className="modal-backdrop" onClick={() => setModal(null)}><div className="request-modal contract-modal" role="dialog" aria-modal="true" aria-labelledby="contract-title" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="drawer-kicker">จัดการสินเชื่อ · สร้างจากคำขอที่อนุมัติ</span><h2 id="contract-title">สร้างสัญญายืมเงิน</h2><p>ตรวจสอบข้อมูลและเงื่อนไขให้ครบก่อนจัดทำสัญญา</p></div><button className="icon-button" onClick={() => setModal(null)} aria-label="ปิด"><Icon name="close" /></button></div>{eligibleLoans.length === 0 ? <div className="contract-empty"><span className="contract-empty-icon"><Icon name="check" /></span><b>ยังไม่มีคำขอที่พร้อมทำสัญญา</b><span>คำขอต้องได้รับอนุมัติก่อน จึงจะสร้างสัญญาได้</span><button className="secondary-button" onClick={() => { setModal(null); router.push("/loans/review"); }}>ไปที่คำขอกู้ยืม</button></div> : <form onSubmit={createContract}><div className="contract-section-label"><span>01</span> เลือกคำขอที่อนุมัติ</div><label>คำขอกู้ยืม<select value={contractLoanId} onChange={(event) => { const loan = loans.find((item) => item.id === event.target.value); setContractLoanId(event.target.value); if (loan) { setContractAmount(String(loan.amount)); setContractInstallments(String(loan.term)); } }} required>{eligibleLoans.map((loan) => <option key={loan.id} value={loan.id}>{loan.id} · {loan.name} · ฿{money(loan.amount)}</option>)}</select></label>{selectedContractLoan && <div className="contract-member-card"><div className={`person-avatar ${selectedContractLoan.color}`}>{selectedContractLoan.initials}</div><div><b>{selectedContractLoan.name}</b><span>{selectedContractLoan.team} · {selectedContractLoan.purpose}</span></div><Status value={selectedContractLoan.status} /></div>}<div className="contract-section-label"><span>02</span> กำหนดเงื่อนไขสัญญา</div><div className="form-row"><label>เงินต้น (บาท)<input type="number" min="1" max={loanLimit} value={contractAmount} onChange={(event) => setContractAmount(event.target.value)} required /><small>วงเงินสูงสุดตามนโยบาย ฿{money(Number(loanLimit))}</small></label><label>จำนวนงวด<input type="number" min="1" max="36" value={contractInstallments} onChange={(event) => setContractInstallments(event.target.value)} required /><small>แบ่งชำระรายเดือน</small></label></div><div className="form-row"><div className="contract-rate-picker"><label>ดอกเบี้ยต่อปี (%)<select className="contract-rate-select" value={customContractInterest ? "custom" : contractInterest} onChange={(event) => { const value = event.target.value; if (value === "custom") setCustomContractInterest(true); else { setContractInterest(value); setCustomContractInterest(false); } }}><option value="0">ไม่คิดดอกเบี้ย · 0%</option>{["5", "10", "15", "20", "25"].map((rate) => <option key={rate} value={rate}>ลดต้นลดดอก · {rate}% ต่อปี</option>)}<option value="custom">กำหนดอัตราเอง</option></select></label>{customContractInterest && <label>ระบุอัตราดอกเบี้ยลดต้นลดดอกต่อปี (%)<input type="number" min="0" max="100" step="0.01" value={contractInterest} onChange={(event) => setContractInterest(event.target.value)} required /></label>}<small>{Number(contractInterest) === 0 ? "แบ่งชำระเงินต้นเท่ากัน โดยไม่มีดอกเบี้ย" : "คำนวณยอดผ่อนรายเดือนจากเงินต้นคงเหลือ"}</small></div><label>วันครบกำหนดงวดแรก<input type="date" name="firstDueOn" defaultValue="2026-11-30" required /><small>งวดถัดไปครบกำหนดวันเดียวกันของเดือน</small></label></div><label>วิธีชำระ<select name="repaymentMethod" defaultValue="หักเงินเดือน"><option>หักเงินเดือน</option><option>โอนเงินผ่านธนาคาร</option><option>ชำระเงินสด</option></select></label><div className="contract-preview"><div className="contract-preview-top"><span>{Number(contractInterest) === 0 ? "ประมาณการแบบไม่คิดดอกเบี้ย" : "ประมาณการแบบลดต้นลดดอก"}</span><span className="preview-chip">ตัวอย่าง</span></div><div className="contract-preview-main"><span>ยอดชำระต่อเดือน</span><b>฿{money(contractPreviewPayment)}<small> / เดือน</small></b></div><div className="contract-preview-details"><span>เงินต้น ฿{money(Number(contractAmount || 0))}</span><i /><span>{contractInstallments || 0} งวด</span><i /><span>รวม ฿{money(contractPreviewPayment * Number(contractInstallments || 0))}</span></div><small className="contract-disclaimer">ยอดจริงอาจเปลี่ยนตามวิธีคำนวณและวันที่ทำสัญญา กรุณาตรวจสอบเงื่อนไขก่อนให้ผู้กู้ลงนาม</small></div><label className="contract-consent"><input type="checkbox" required /> <span>ยืนยันว่าตรวจสอบวงเงิน อัตราดอกเบี้ย และกำหนดชำระแล้ว</span></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>ยกเลิก</button><button type="submit" className="primary-button"><Icon name="file" size={16} /> บันทึกสัญญาฉบับร่าง</button></div><div className="contract-footnote">ระบบจะบันทึกสัญญาเป็น “รอลงนาม” และยังไม่เริ่มนับงวดชำระ</div></form>}</div></div>}

      {modal === "member" && <div className="modal-backdrop" onClick={() => setModal(null)}><div className="request-modal member-modal" role="dialog" aria-modal="true" aria-labelledby="member-title" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="drawer-kicker">สมาชิก · {editingMember ? "แก้ไขข้อมูล" : "เพิ่มรายชื่อ"}</span><h2 id="member-title">{editingMember ? "แก้ไขสมาชิก" : "เพิ่มสมาชิก"}</h2><p>ข้อมูลบัตรประชาชน รูปถ่าย และที่อยู่จะเห็นได้เฉพาะผู้ดูแลระบบ</p></div><button className="icon-button" onClick={() => { setModal(null); setEditingMember(null); }} aria-label="ปิด"><Icon name="close" /></button></div><button type="button" className="secondary-button member-card-reader-trigger" onClick={readCardIntoMemberForm} disabled={memberCardReading}><Icon name={memberCardReading ? "clock" : "card"} size={15} />{memberCardReading ? "กำลังอ่านบัตร…" : "อ่านข้อมูลและรูปจากบัตร"}</button><form ref={memberFormRef} key={editingMember?.id ?? "new-member"} onSubmit={createMember}><input type="hidden" name="photoData" value={memberPhotoData} readOnly />{memberPhotoData && <div className="member-card-photo-preview"><img src={`data:image/jpeg;base64,${memberPhotoData}`} alt={`รูปจากบัตรของ ${editingMember?.name || "สมาชิก"}`} /><span>รูปถ่ายจากชิปบัตร · ตรวจทานก่อนบันทึก</span></div>}<div className="form-row"><label>ชื่อและนามสกุล<input name="memberName" required defaultValue={editingMember?.name || ""} placeholder="กรอกชื่อตามบัตรประชาชน" /></label><label>รหัสสมาชิก<input name="employeeCode" defaultValue={editingMember?.employeeCode ?? ""} placeholder="เว้นว่างเพื่อสร้างรหัสอัตโนมัติ" /></label></div><div className="form-row"><label>ชื่อเล่น<input name="nickname" defaultValue={editingMember?.nickname ?? ""} /></label><label>แผนก<input name="team" defaultValue={editingMember?.team ?? ""} placeholder="เช่น ฝ่ายผลิต" /></label></div><label>เบอร์โทรศัพท์<input name="phone" type="tel" defaultValue={editingMember?.phone ?? ""} /></label><details className="member-extra-fields" open={memberDetailsOpen} onToggle={(event) => setMemberDetailsOpen(event.currentTarget.open)}><summary>ข้อมูลอ้างอิงจากบัตรประชาชน</summary><p className="member-extra-hint">ตรวจทานข้อมูลที่อ่านได้ก่อนบันทึก · ทุกช่องไม่บังคับกรอก</p><div className="form-row"><label>เลขประจำตัวประชาชน<input name="nationalId" inputMode="numeric" autoComplete="off" maxLength={13} defaultValue={editingMember?.nationalId || ""} placeholder="เลข 13 หลัก" /><small>เก็บเฉพาะเพื่อใช้อ้างอิงข้อมูลสมาชิก</small></label><label>วันเกิด<input name="dateOfBirth" placeholder="YYYY-MM-DD" autoComplete="bday" defaultValue={editingMember?.dateOfBirth || ""} /><small>ใช้รูปแบบปี ค.ศ. เช่น 1987-05-14</small></label></div><label>ที่อยู่ตามบัตร<textarea name="address" rows={2} autoComplete="street-address" defaultValue={editingMember?.address || ""} placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด และรหัสไปรษณีย์" /></label></details><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setModal(null); setEditingMember(null); }}>ยกเลิก</button><button type="submit" className="primary-button">{editingMember ? "บันทึกการแก้ไข" : "บันทึกสมาชิก"} <Icon name="check" size={16} /></button></div></form></div></div>}

      {toast && <Toast toast={toast} onDismiss={dismissToast} />}
    </main>
  );
}
