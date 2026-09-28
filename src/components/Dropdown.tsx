"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Opt = { value: string; label: string };

// Dropdown de filtro: busca dentro da lista, multi-seleção com caixinhas, contador no
// botão, teclado (setas/Enter/Esc) e popover fixo (não é cortado por áreas roláveis).
export default function Dropdown({
  label,
  options,
  value,
  onChange,
  multi = false,
  searchable = true,
  disabled = false,
  emptyText = "Nada encontrado",
}: {
  label: string;
  options: Opt[];
  value: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
  searchable?: boolean;
  disabled?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [cursor, setCursor] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filtradas = useMemo(() => {
    const n = norm(q.trim());
    return n ? options.filter((o) => norm(o.label).includes(n)) : options;
  }, [options, q]);

  useEffect(() => {
    if (open && searchable) setTimeout(() => inputRef.current?.focus(), 20);
    if (!open) {
      setQ("");
      setCursor(0);
    }
  }, [open, searchable]);

  function abrir() {
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ x: r.left, y: r.bottom + 6 });
    setOpen((v) => !v);
  }

  function escolher(v: string) {
    if (multi) onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    else {
      onChange(value[0] === v ? [] : [v]);
      setOpen(false);
    }
  }

  const rotuloBotao = value.length === 0 ? label : multi && value.length > 1 ? `${label} · ${value.length}` : options.find((o) => o.value === value[0])?.label || value[0];
  const ativo = value.length > 0;

  return (
    <>
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        onClick={abrir}
        className={`flex h-9 max-w-[220px] items-center gap-2 rounded-lg border px-3 text-sm transition disabled:opacity-40 ${
          ativo ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <span className="truncate">{ativo && !multi ? rotuloBotao : ativo ? rotuloBotao : label}</span>
        <svg className="h-3.5 w-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onMouseDown={() => setOpen(false)} />
          <div
            className="fixed z-[71] w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            style={{ left: Math.min(pos.x, window.innerWidth - 272), top: pos.y }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(filtradas.length - 1, c + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
              if (e.key === "Enter" && filtradas[cursor]) { e.preventDefault(); escolher(filtradas[cursor].value); }
            }}
          >
            {searchable && (
              <div className="border-b border-slate-100 p-2">
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setCursor(0); }}
                  placeholder={`Buscar ${label.toLowerCase()}…`}
                  className="w-full rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
            )}
            {multi && (
              <div className="flex items-center justify-between px-3 py-1.5 text-xs">
                <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => onChange(Array.from(new Set([...value, ...filtradas.map((o) => o.value)])))}>
                  Selecionar {q ? "resultados" : "todos"}
                </button>
                <button type="button" className="text-slate-400 hover:text-slate-600" onClick={() => onChange([])}>Limpar</button>
              </div>
            )}
            <ul className="max-h-64 overflow-y-auto py-1">
              {filtradas.length === 0 && <li className="px-3 py-3 text-center text-sm text-slate-400">{emptyText}</li>}
              {filtradas.map((o, i) => {
                const on = value.includes(o.value);
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => escolher(o.value)}
                      onMouseEnter={() => setCursor(i)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${i === cursor ? "bg-slate-50" : ""} ${on ? "font-medium text-indigo-700" : "text-slate-700"}`}
                    >
                      {multi ? (
                        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>
                          {on && <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4"><path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </span>
                      ) : (
                        <span className={`h-2 w-2 shrink-0 rounded-full ${on ? "bg-indigo-600" : "bg-transparent"}`} />
                      )}
                      <span className="truncate">{o.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
