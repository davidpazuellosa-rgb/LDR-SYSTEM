"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// Substitui confirm()/prompt() do navegador por janelas com a cara do sistema.
//   const dialog = useDialog();
//   if (!(await dialog.confirm({ title, message, danger: true }))) return;
//   const nome = await dialog.prompt({ title, label, defaultValue }); // null = cancelou
type ConfirmOpts = { title: string; message?: string; confirmLabel?: string; danger?: boolean };
type PromptOpts = {
  title: string;
  message?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  danger?: boolean;
  inputMode?: "text" | "numeric";
};

type Ask =
  | ({ kind: "confirm"; resolve: (v: boolean) => void } & ConfirmOpts)
  | ({ kind: "prompt"; resolve: (v: string | null) => void } & PromptOpts);

type Ctx = {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
};

const DialogCtx = createContext<Ctx | null>(null);

export function useDialog() {
  const ctx = useContext(DialogCtx);
  if (!ctx) throw new Error("useDialog precisa do <DialogProvider>");
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback(
    (o: ConfirmOpts) => new Promise<boolean>((resolve) => setAsk({ kind: "confirm", resolve, ...o })),
    [],
  );
  const prompt = useCallback(
    (o: PromptOpts) =>
      new Promise<string | null>((resolve) => {
        setValue(o.defaultValue ?? "");
        setAsk({ kind: "prompt", resolve, ...o });
      }),
    [],
  );

  function close(ok: boolean) {
    if (!ask) return;
    if (ask.kind === "confirm") ask.resolve(ok);
    else ask.resolve(ok ? value : null);
    setAsk(null);
  }

  useEffect(() => {
    if (ask?.kind === "prompt") setTimeout(() => inputRef.current?.select(), 30);
  }, [ask]);

  useEffect(() => {
    if (!ask) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter" && ask.kind === "confirm") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask, value]);

  const danger = !!ask?.danger;

  return (
    <DialogCtx.Provider value={{ confirm, prompt }}>
      {children}
      {ask && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
          onMouseDown={(e) => e.target === e.currentTarget && close(false)}
        >
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                  danger ? "bg-red-50 text-red-500" : "bg-indigo-50 text-indigo-600"
                }`}
              >
                {danger ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
                    <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v5M12 16.5v.5" strokeLinecap="round" />
                  </svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-slate-800">{ask.title}</h2>
                {ask.message && <p className="mt-1 whitespace-pre-line text-sm text-slate-500">{ask.message}</p>}
              </div>
            </div>

            {ask.kind === "prompt" && (
              <label className="mt-4 block text-sm font-medium text-slate-700">
                {ask.label}
                <input
                  ref={inputRef}
                  value={value}
                  inputMode={ask.inputMode}
                  placeholder={ask.placeholder}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && close(true)}
                  autoFocus
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500"
                />
              </label>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                  danger ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {ask.confirmLabel || (ask.kind === "prompt" ? "Salvar" : "Confirmar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogCtx.Provider>
  );
}
