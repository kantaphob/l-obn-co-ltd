"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
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

type ToastContextValue = (message: string, kind?: ToastKind) => void;
const ToastContext = createContext<ToastContextValue | null>(null);

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
      {toast.kind !== "loading" && <i className="toast-timer" style={{ animationDuration: `${duration}ms` }} aria-hidden="true" />}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const sequence = useRef(0);
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const notify = useCallback<ToastContextValue>((message, kind) => {
    const inferredKind = kind
      ?? (/ไม่สำเร็จ|ผิดพลาด|ไม่พบ|ไม่สามารถ|เชื่อมต่อระบบไม่สำเร็จ/.test(message) ? "error"
        : /กรุณา|รอพิจารณา|ต้องตรวจสอบ/.test(message) ? "warning"
          : /บันทึก|เพิ่ม|แก้ไข|นำออก|สร้าง|อนุมัติ|ดาวน์โหลด|เรียบร้อย|สำเร็จ/.test(message) ? "success"
            : "info");
    const toast = { id: ++sequence.current, message, kind: inferredKind };
    setToasts((current) => [...current, toast]);
  }, []);

  return <ToastContext.Provider value={notify}>
    {children}
    <div className="toast-stack" aria-label="การแจ้งเตือน" aria-live="polite">
      {toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={dismiss} duration={toast.kind === "error" ? 6000 : 3600} />)}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast ต้องอยู่ภายใน ToastProvider");
  return notify;
}
