"use client";

import { useEffect } from "react";
import { Icon } from "./icon";

export type ToastKind = "success" | "error" | "warning" | "info" | "loading";

export type ToastMessage = {
  id: number;
  message: string;
  kind: ToastKind;
};

type ToastProps = {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
  duration?: number;
};

const toastContent: Record<ToastKind, { title: string; icon: string }> = {
  success: { title: "สำเร็จ", icon: "check" },
  error: { title: "เกิดข้อผิดพลาด", icon: "close" },
  warning: { title: "โปรดตรวจสอบ", icon: "alert" },
  info: { title: "แจ้งเตือน", icon: "info" },
  loading: { title: "กำลังดำเนินการ", icon: "clock" },
};

export function Toast({ toast, onDismiss, duration = 3600 }: ToastProps) {
  useEffect(() => {
    if (toast.kind === "loading") return;
    const timeout = window.setTimeout(() => onDismiss(toast.id), duration);
    return () => window.clearTimeout(timeout);
  }, [duration, onDismiss, toast.id, toast.kind]);

  const content = toastContent[toast.kind];
  return (
    <div
      key={toast.id}
      className={`toast toast-${toast.kind}`}
      role={toast.kind === "error" ? "alert" : "status"}
      aria-live={toast.kind === "error" ? "assertive" : "polite"}
    >
      <span className="toast-icon" aria-hidden="true">
        {toast.kind === "loading" ? <i className="toast-spinner" /> : <Icon name={content.icon} size={17} />}
      </span>
      <span className="toast-copy"><b>{content.title}</b><span>{toast.message}</span></span>
      <button className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="ปิดการแจ้งเตือน">
        <Icon name="close" size={15} />
      </button>
      {toast.kind !== "loading" && <i className="toast-timer" aria-hidden="true" />}
    </div>
  );
}
