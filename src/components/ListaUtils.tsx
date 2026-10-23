"use client";

import { useEffect, useState } from "react";

// Peças compartilhadas das telas de Bases: chave Cards | Lista (lembrada no navegador, a mesma
// escolha vale nos dois níveis) e cabeçalho de tabela que ordena ao clicar.

export type Visao = "cards" | "lista";
const CHAVE_VISAO = "basesVisao";

export function useVisao(): [Visao, (v: Visao) => void] {
  const [visao, setVisao] = useState<Visao>("cards");
  useEffect(() => {
    try {
      const v = localStorage.getItem(CHAVE_VISAO);
      if (v === "cards" || v === "lista") setVisao(v);
    } catch { /* sem armazenamento: segue em cards */ }
  }, []);
  function escolher(v: Visao) {
    setVisao(v);
    try { localStorage.setItem(CHAVE_VISAO, v); } catch { /* ignora */ }
  }
  return [visao, escolher];
}

export function VisaoToggle({ visao, onChange }: { visao: Visao; onChange: (v: Visao) => void }) {
  return (
    <div role="group" aria-label="Formato de visualização" className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white p-0.5">
      {([["cards", "Cards"], ["lista", "Lista"]] as const).map(([v, t]) => (
        <button
          key={v}
          type="button"
          aria-pressed={visao === v}
          onClick={() => onChange(v)}
          title={v === "cards" ? "Ver em cartões" : "Ver em lista"}
          className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition ${visao === v ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800"}`}
        >
          {v === "cards" ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" /></svg>
          )}
          {t}
        </button>
      ))}
    </div>
  );
}

// Ordenação por clique: 1º clique = crescente, 2º = decrescente, 3º = volta à ordem padrão.
export type Ord = { k: string; dir: 1 | -1 } | null;
export const proximaOrd = (ord: Ord, k: string): Ord => (!ord || ord.k !== k ? { k, dir: 1 } : ord.dir === 1 ? { k, dir: -1 } : null);

export function ThSort({
  k, ord, onSort, children, direita = false, className = "",
}: { k: string; ord: Ord; onSort: (k: string) => void; children: React.ReactNode; direita?: boolean; className?: string }) {
  const ativo = ord?.k === k;
  return (
    <th
      aria-sort={ativo ? (ord!.dir === 1 ? "ascending" : "descending") : "none"}
      className={`group px-3 py-3 font-medium ${direita ? "text-right" : ""} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        title="Clique para ordenar"
        className={`inline-flex items-center gap-1 rounded transition hover:text-slate-800 ${direita ? "flex-row-reverse" : ""} ${ativo ? "text-indigo-600" : ""}`}
      >
        {children}
        <span className={`text-[10px] leading-none ${ativo ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}>{ativo ? (ord!.dir === 1 ? "▲" : "▼") : "▲"}</span>
      </button>
    </th>
  );
}
