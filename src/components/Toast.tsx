"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastType = "success" | "error" | "loading";
type Toast = { id: number; type: ToastType; title: string; description?: string };

type ToastCtx = {
  show: (toast: Omit<Toast, "id">) => number;
  success: (title: string, description?: string) => number;
  error: (title: string, description?: string) => number;
  loading: (title: string, description?: string) => number;
  update: (id: number, toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
};

const Ctx = createContext<ToastCtx | null>(null);
let counter = 0;

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast precisa do <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = ++counter;
      setToasts((prev) => [{ id, ...toast }, ...prev].slice(0, 4));
      if (toast.type !== "loading") setTimeout(() => dismiss(id), 4500);
      return id;
    },
    [dismiss],
  );

  const success = useCallback((title: string, description?: string) => show({ type: "success", title, description }), [show]);
  const error = useCallback((title: string, description?: string) => show({ type: "error", title, description }), [show]);
  const loading = useCallback((title: string, description?: string) => show({ type: "loading", title, description }), [show]);
  const update = useCallback(
    (id: number, toast: Omit<Toast, "id">) => {
      setToasts((prev) => prev.map((item) => (item.id === id ? { id, ...toast } : item)));
      if (toast.type !== "loading") setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  return (
    <Ctx.Provider value={{ show, success, error, loading, update, dismiss }}>
      {children}
      <div className="pointer-events-none fixed right-5 top-5 z-[100] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={() => dismiss(toast.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastIcon({ type }: { type: ToastType }) {
  if (type === "loading") {
    return <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />;
  }

  if (type === "success") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 8v5" strokeLinecap="round" />
      <path d="M12 17h.01" strokeLinecap="round" />
      <path d="M10.3 4.3 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
    </svg>
  );
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-emerald-900/10",
    error: "border-red-200 bg-red-50 text-red-800 shadow-red-900/10",
    loading: "border-indigo-200 bg-indigo-50 text-indigo-800 shadow-indigo-900/10",
  }[toast.type];

  const iconStyles = {
    success: "bg-emerald-600 text-white",
    error: "bg-red-600 text-white",
    loading: "bg-white text-indigo-600",
  }[toast.type];

  return (
    <div className={`pointer-events-auto relative rounded-xl border p-4 shadow-lg ${styles}`}>
      <button
        onClick={onClose}
        className="absolute -left-2 -top-2 grid h-5 w-5 place-items-center rounded-full border border-current bg-white/90 text-xs leading-none opacity-80 hover:opacity-100"
        aria-label="Fechar notificação"
      >
        ×
      </button>
      <div className="flex gap-3">
        <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${iconStyles}`}>
          <ToastIcon type={toast.type} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{toast.title}</div>
          {toast.description && <div className="mt-1 text-sm opacity-85">{toast.description}</div>}
        </div>
      </div>
    </div>
  );
}
