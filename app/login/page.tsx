"use client";

import { FormEvent, useState } from "react";
import { useToast } from "../../components/toast";

export default function LoginPage() {
  const notify = useToast();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const result = await response.json();
      if (!response.ok) {
        notify(result.message ?? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง", "error");
        return;
      }
      window.location.assign("/");
    } catch {
      notify("เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark"><span /><span /><span /></div>
          <div><b>ใจดี</b><small>LOAN MANAGEMENT</small></div>
        </div>
        <span className="login-kicker">พื้นที่สำหรับผู้ดูแล</span>
        <h1>ยินดีต้อนรับกลับ</h1>
        <p className="login-description">เข้าสู่ระบบเพื่อจัดการสินเชื่อและข้อมูลขององค์กร</p>
        <form onSubmit={submit} className="login-form">
          <label htmlFor="username">ชื่อผู้ใช้</label>
          <input id="username" name="username" autoComplete="username" required autoFocus />
          <label htmlFor="password">รหัสผ่าน</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
          <button className="login-submit" type="submit" disabled={pending}>{pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</button>
        </form>
        <p className="login-footer">บัญชีนี้มีสิทธิ์ผู้ดูแลระบบเต็มรูปแบบ</p>
      </section>
    </main>
  );
}
