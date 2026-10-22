"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "./icon";

type CurrentUser = { username: string; displayName: string; role: string } | null;
type MenuItem = { label: string; icon: string; href: string };
type MenuGroup = { category: string; items: MenuItem[] };

type SidebarProps = {
  activeNav: string;
  currentUser: CurrentUser;
  companyName: string;
  mobileMenu: boolean;
  pendingApprovalCount: number;
  onCloseMobileMenu: () => void;
  onNavigate: () => void;
  onLogout: () => void;
  onNotify: (message: string) => void;
};

const menuGroups: MenuGroup[] = [
  { category: "ภาพรวม", items: [{ label: "ภาพรวม", icon: "grid", href: "/" }] },
  { category: "ผู้กู้และสมาชิก", items: [{ label: "ผู้กู้", icon: "people", href: "/borrowers" }] },
  { category: "จัดการสินเชื่อ", items: [{ label: "พิจารณาอนุมัติ", icon: "approval", href: "/loans/review" }, { label: "สัญญากู้", icon: "file", href: "/loans/contracts" }] },
  { category: "ติดตามรับชำระ", items: [{ label: "ตารางงวด", icon: "calendar", href: "/repayments/schedule" }, { label: "ค้างชำระ", icon: "clock", href: "/repayments/overdue" }] },
  { category: "การเงินและรายงาน", items: [{ label: "รายรับรายจ่าย", icon: "book", href: "/accounting/ledger" }, { label: "ผลดำเนินงาน", icon: "chart", href: "/reports/performance" }] },
  { category: "ระบบ", items: [{ label: "ตั้งค่าระบบ", icon: "settings", href: "/settings" }] },
];

export const navByPath: Record<string, string> = {
  "/": "ภาพรวม",
  "/borrowers": "ผู้กู้",
  "/loans/review": "พิจารณาอนุมัติ",
  "/loans/contracts": "สัญญากู้",
  "/repayments/schedule": "ตารางงวด",
  "/repayments/overdue": "ค้างชำระ",
  "/accounting/ledger": "รายรับรายจ่าย",
  "/reports/performance": "ผลดำเนินงาน",
  "/settings": "ตั้งค่าระบบ",
};

export function Sidebar({ activeNav, currentUser, companyName, mobileMenu, pendingApprovalCount, onCloseMobileMenu, onNavigate, onLogout, onNotify }: SidebarProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const displayName = currentUser?.displayName ?? currentUser?.username ?? "กำลังโหลดบัญชี";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A";
  const roleLabel = currentUser?.role === "admin" ? "ผู้ดูแลระบบ" : currentUser?.role ?? "บัญชีผู้ใช้";

  return (
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <div className="brand">
        <div className="brand-mark"><span /><span /><span /></div>
        <div><b>ใจดี</b><small>LOAN MANAGEMENT</small></div>
        <button className="mobile-close" onClick={onCloseMobileMenu} aria-label="ปิดเมนู"><Icon name="close" /></button>
      </div>
      <div className="workspace">
        <div className="workspace-avatar">L</div>
        <div className="workspace-copy"><b>{companyName}</b><small>พื้นที่ทำงานของบริษัท</small></div>
        <span className="workspace-chevron">⌄</span>
      </div>
      <nav className="main-nav" aria-label="เมนูตามประเภท">
        {menuGroups.map((group) => (
          <div className="nav-group" key={group.category}>
            <button
              className="nav-caption"
              aria-expanded={!collapsedGroups[group.category]}
              onClick={() => setCollapsedGroups((current) => ({ ...current, [group.category]: !current[group.category] }))}
            >
              <span className="nav-caption-dot" />{group.category}<Icon name="chevron-down" size={17} />
            </button>
            {!collapsedGroups[group.category] && (
              <div className="nav-group-items">
                {group.items.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    aria-current={activeNav === item.label ? "page" : undefined}
                    className={`nav-item ${activeNav === item.label ? "active" : ""}`}
                    onClick={onNavigate}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                    {item.label === "พิจารณาอนุมัติ" && pendingApprovalCount > 0 && <em>{pendingApprovalCount}</em>}
                    {activeNav === item.label && <i className="nav-active-dot" />}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card">
          <div className="help-icon">✳</div>
          <b>ต้องการความช่วยเหลือ?</b>
          <p>ทีมงานใจดีพร้อมช่วยคุณเสมอ</p>
          <button onClick={() => onNotify("ทีมงานจะติดต่อกลับโดยเร็วที่สุด")}>ติดต่อทีมงาน <Icon name="arrow" size={15} /></button>
        </div>
        <div className="profile-card" aria-label="โปรไฟล์ผู้ใช้">
          <div className="profile-card-main">
            <div className="profile-avatar">{initials}</div>
            <div className="profile-identity">
              <b title={displayName}>{displayName}</b>
              <small>{currentUser ? `@${currentUser.username}` : "กำลังโหลดบัญชีผู้ใช้"}</small>
            </div>
            <button className="profile-logout" aria-label="ออกจากระบบ" title="ออกจากระบบ" onClick={onLogout}><Icon name="logout" size={17} /></button>
          </div>
          <div className="profile-card-meta"><span className="profile-online"><i /> ใช้งานอยู่</span><span className="profile-role">{roleLabel}</span></div>
        </div>
      </div>
    </aside>
  );
}
