"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export type ColumnFilterPopoverProps = {
  label: string;
  anchorRect: DOMRect;
  values: { value: string; count: number }[];
  selected: Set<string> | null; // null = sem filtro (tudo selecionado)
  sortDir: "asc" | "desc" | null; // ordenação ativa nesta coluna (compartilhada)
  onSort: (dir: "asc" | "desc") => void;
  onApply: (selected: Set<string> | null) => void;
  onClear: () => void;
  onClose: () => void;
};

const VAZIO = "(Vazio)";

export default function ColumnFilterPopover({
  label,
  anchorRect,
  values,
  selected,
  sortDir,
  onSort,
  onApply,
  onClear,
  onClose,
}: ColumnFilterPopoverProps) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Set<string>>(() => (selected ? new Set(selected) : new Set(values.map((v) => v.value))));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return values;
    return values.filter((v) => (v.value ? v.value.toLowerCase().includes(q) : VAZIO.toLowerCase().includes(q)));
  }, [values, search]);

  const todasMarcadas = filtrados.length > 0 && filtrados.every((v) => draft.has(v.value));

  function toggleTudo() {
    setDraft((prev) => {
      const next = new Set(prev);
      if (todasMarcadas) filtrados.forEach((v) => next.delete(v.value));
      else filtrados.forEach((v) => next.add(v.value));
      return next;
    });
  }
  function toggleValor(v: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }

  const top = anchorRect.bottom + 4;
  const left = Math.min(anchorRect.left, window.innerWidth - 272);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70]" onMouseDown={onClose} />
      <div
        className="fixed z-[71] w-64 rounded-lg border border-slate-200 bg-white py-2 shadow-xl"
        style={{ top, left }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>

        <button
          onClick={() => onSort("asc")}
          className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-slate-100 ${sortDir === "asc" ? "font-semibold text-indigo-600" : "text-slate-700"}`}
        >
          <span className="text-xs">A→Z</span> Classificar A → Z
        </button>
        <button
          onClick={() => onSort("desc")}
          className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-slate-100 ${sortDir === "desc" ? "font-semibold text-indigo-600" : "text-slate-700"}`}
        >
          <span className="text-xs">Z→A</span> Classificar Z → A
        </button>

        <div className="my-1.5 h-px bg-slate-200" />

        <div className="px-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar valor…"
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-indigo-400"
          />
        </div>

        <label className="mt-1.5 flex cursor-pointer items-center gap-2 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50">
          <input type="checkbox" checked={todasMarcadas} onChange={toggleTudo} className="h-3.5 w-3.5" />
          Selecionar tudo
        </label>

        <div className="max-h-48 overflow-y-auto border-t border-slate-100 px-3 py-1">
          {filtrados.length === 0 ? (
            <p className="py-2 text-center text-xs text-slate-400">Nenhum valor encontrado.</p>
          ) : (
            filtrados.map((v) => (
              <label key={v.value || "__vazio__"} className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
                <input type="checkbox" checked={draft.has(v.value)} onChange={() => toggleValor(v.value)} className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{v.value || VAZIO}</span>
                <span className="shrink-0 text-xs text-slate-400">{v.count}</span>
              </label>
            ))
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-slate-100 px-3 pt-2">
          <button onClick={onClear} className="text-xs font-medium text-slate-500 hover:text-slate-700">
            Limpar filtro
          </button>
          <div className="flex gap-1.5">
            <button onClick={onClose} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button
              onClick={() => onApply(draft.size === values.length ? null : draft)}
              className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
