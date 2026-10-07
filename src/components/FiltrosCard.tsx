"use client";

import { useState } from "react";
import Link from "next/link";

// Padrão de filtros do sistema: SEMPRE um botão "Filtros" que abre um card com os filtros
// dentro. `ativos` = quantos filtros fora do padrão (aparece no botão); `onLimpar` ou
// `limparHref` mostram o "Limpar tudo"; `direita` é para ações (ex.: exportar) ao lado.
export function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-500">{titulo}</div>
      {children}
    </div>
  );
}


export default function FiltrosCard({
  ativos, onLimpar, limparHref, direita, children,
}: {
  ativos: number;
  onLimpar?: () => void;
  limparHref?: string;
  direita?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${aberto || ativos ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h18M6 12h12M10 19h4" strokeLinecap="round" /></svg>
          Filtros
          {ativos > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-xs text-white">{ativos}</span>}
        </button>
        {ativos > 0 && onLimpar && (
          <button type="button" onClick={onLimpar} className="h-9 rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-red-500">Limpar tudo</button>
        )}
        {ativos > 0 && !onLimpar && limparHref && (
          <Link href={limparHref} className="flex h-9 items-center rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-red-500">Limpar tudo</Link>
        )}
        {direita && <div className="ml-auto flex flex-wrap items-center gap-1.5">{direita}</div>}
      </div>
      {aberto && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
        </div>
      )}
    </div>
  );
}
