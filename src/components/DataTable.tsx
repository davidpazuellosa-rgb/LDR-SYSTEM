"use client";

import { useMemo, useState } from "react";

// Tabela padrão dos relatórios: ordenar clicando no cabeçalho, busca, linha de total,
// barra colorida dentro da célula de % e exportar CSV. As colunas são DADOS (não
// funções) para poder ser usada direto de Server Components.
export type Col = {
  key: string;
  label: string;
  kind?: "text" | "num" | "pct" | "status";
  align?: "left" | "right";
  // Só para kind "pct": limites de cor (verde ≥ ok, âmbar ≥ meio, senão vermelho)
  ok?: number;
  meio?: number;
};
export type Row = Record<string, string | number | null | undefined>;

const STATUS = {
  ok: { label: "No ritmo", cls: "bg-emerald-50 text-emerald-700" },
  risco: { label: "Em risco", cls: "bg-amber-50 text-amber-700" },
  atrasado: { label: "Atrasado", cls: "bg-rose-50 text-rose-600" },
} as const;

const nf = (n: number) => n.toLocaleString("pt-BR");

function corPct(v: number, ok = 80, meio = 50) {
  return v >= ok ? "bg-emerald-500" : v >= meio ? "bg-amber-400" : "bg-rose-500";
}

export default function DataTable({
  cols,
  rows,
  total,
  searchKeys = [],
  searchPlaceholder = "Buscar",
  maxHeight = 420,
  csvName,
  defaultSort,
  empty = "Nada para mostrar.",
}: {
  cols: Col[];
  rows: Row[];
  total?: Row;
  searchKeys?: string[];
  searchPlaceholder?: string;
  maxHeight?: number;
  csvName?: string;
  defaultSort?: { key: string; dir: 1 | -1 };
  empty?: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(defaultSort ?? null);

  const view = useMemo(() => {
    const n = q.trim().toLowerCase();
    let list = n ? rows.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(n))) : rows;
    if (sort) {
      const { key, dir } = sort;
      list = [...list].sort((a, b) => {
        const x = a[key], y = b[key];
        // vazio (null) sempre no fim, qualquer que seja a direção
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
        return String(x).localeCompare(String(y), "pt-BR") * dir;
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort]);

  function ordenar(key: string, kind?: Col["kind"]) {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: kind === "text" || !kind ? 1 : -1 }));
  }

  function exportar() {
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = [cols.map((c) => esc(c.label)).join(";"), ...view.map((r) => cols.map((c) => esc(r[c.key])).join(";"))];
    if (total) linhas.push(cols.map((c) => esc(total[c.key])).join(";"));
    const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${csvName || "tabela"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function celula(c: Col, r: Row) {
    const v = r[c.key];
    if (c.kind === "pct") {
      if (v == null) return <span className="text-slate-300">—</span>;
      const n = Number(v);
      return (
        <div className="flex items-center justify-end gap-2">
          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 sm:block">
            <div className={`h-full rounded-full ${corPct(n, c.ok, c.meio)}`} style={{ width: `${Math.max(2, Math.min(100, n))}%` }} />
          </div>
          <span className="w-10 text-right tabular-nums text-slate-700">{n}%</span>
        </div>
      );
    }
    if (c.kind === "status") {
      const s = STATUS[v as keyof typeof STATUS];
      return s ? <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span> : <span className="text-slate-300">—</span>;
    }
    if (c.kind === "num") return v == null ? <span className="text-slate-300">—</span> : <span className="tabular-nums">{nf(Number(v))}</span>;
    return <span>{v == null || v === "" ? "—" : String(v)}</span>;
  }

  return (
    <div>
      {(searchKeys.length > 0 || csvName) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {searchKeys.length > 0 ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5">
              <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="w-44 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" />
            </div>
          ) : <span />}
          {csvName && (
            <button type="button" onClick={exportar} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Exportar CSV
            </button>
          )}
        </div>
      )}
      <div className="overflow-auto rounded-lg border border-slate-100" style={{ maxHeight }}>
        <table className="w-full min-w-[480px] text-sm">
          <thead className="sticky top-0 z-[1] bg-slate-50 text-xs text-slate-500">
            <tr>
              {cols.map((c) => (
                <th key={c.key} className={`px-3 py-2 font-medium ${c.align === "right" || (c.kind && c.kind !== "text") ? "text-right" : "text-left"}`}>
                  <button type="button" onClick={() => ordenar(c.key, c.kind)} className={`inline-flex items-center gap-1 hover:text-slate-800 ${sort?.key === c.key ? "text-indigo-600" : ""}`}>
                    {c.label}
                    {sort?.key === c.key && <span>{sort.dir === 1 ? "▲" : "▼"}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {view.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50/70">
                {cols.map((c) => (
                  <td key={c.key} className={`px-3 py-2 ${c.align === "right" || (c.kind && c.kind !== "text") ? "text-right" : "text-left text-slate-700"}`}>{celula(c, r)}</td>
                ))}
              </tr>
            ))}
            {view.length === 0 && (
              <tr><td colSpan={cols.length} className="px-3 py-8 text-center text-sm text-slate-400">{empty}</td></tr>
            )}
          </tbody>
          {total && (
            <tfoot className="sticky bottom-0 border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
              <tr>
                {cols.map((c) => (
                  <td key={c.key} className={`px-3 py-2 ${c.align === "right" || (c.kind && c.kind !== "text") ? "text-right" : "text-left"}`}>{celula(c, total)}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
