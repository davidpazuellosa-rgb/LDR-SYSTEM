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
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(340px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={() => dismiss(toast.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastIcon({ type }: { type: ToastType }) {
  if (type === "loading") {
    return <span className="block h-[18px] w-[18px] animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />;
  }
  if (type === "success") {
    return (
      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.4 2.4 4.6-5.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" strokeLinecap="round" />
      <path d="M12 16.2h.01" strokeLinecap="round" />
    </svg>
  );
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const accent = {
    success: "text-emerald-600",
    error: "text-red-600",
    loading: "text-indigo-600",
  }[toast.type];

  const bar = {
    success: "bg-emerald-500",
    error: "bg-red-500",
    loading: "bg-indigo-500",
  }[toast.type];

  return (
    <div
      className="pointer-events-auto group relative flex w-full items-start gap-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-2.5 shadow-lg shadow-slate-900/5"
      style={{ animation: "toast-in 0.18s ease-out" }}
    >
      <span className={`mt-0.5 shrink-0 ${accent}`}>
        <ToastIcon type={toast.type} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight text-slate-800">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs leading-snug text-slate-500">{toast.description}</p>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Fechar"
        className="-mr-0.5 shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition hover:text-slate-500 group-hover:opacity-100"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      </button>

      {toast.type === "loading" ? (
        <span
          className={`absolute left-0 top-0 h-[2px] w-1/3 rounded-full ${bar}`}
          style={{ animation: "toast-indeterminate 1.1s ease-in-out infinite" }}
        />
      ) : (
        <span
          className={`absolute bottom-0 left-0 h-[2px] w-full origin-left ${bar} opacity-70`}
          style={{ animation: "toast-progress 4.5s linear forwards" }}
        />
      )}
    </div>
  );
}
