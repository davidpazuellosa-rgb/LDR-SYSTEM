"use client";

import { useState } from "react";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DIAS_LONGO = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

export type RankingCelula = Record<string, { nome: string; qtd: number }[]>;

// Mapa de calor dia da semana × hora. Com `ranking`, cada quadradinho é clicável e abre
// o ranking de quem mais produziu naquele dia e hora.
export default function HeatmapClick({
  mapa,
  pico,
  ranking,
  rotulos = "6",
}: {
  mapa: number[][];
  pico: number;
  ranking?: RankingCelula;
  rotulos?: "3" | "6";
}) {
  const [sel, setSel] = useState<{ d: number; h: number } | null>(null);
  const lista = sel && ranking ? ranking[`${sel.d}:${sel.h}`] ?? [] : [];
  const total = lista.reduce((a, x) => a + x.qtd, 0);
  const max = Math.max(1, ...lista.map((x) => x.qtd));
  const passo = Number(rotulos);

  return (
    <div>
      <div className="space-y-[3px]">
        <div className="flex items-center gap-[2px] pl-8 text-[9px] text-slate-400">
          {Array.from({ length: 24 }, (_, hora) => <span key={hora} className="flex-1 text-center">{hora % passo === 0 ? `${hora}h` : ""}</span>)}
        </div>
        {mapa.map((linha, d) => (
          <div key={d} className="flex items-center gap-[2px]">
            <span className="w-8 shrink-0 text-[10px] font-medium text-slate-400">{DIAS[d]}</span>
            {linha.map((v, hora) => {
              const ativo = sel?.d === d && sel.h === hora;
              const cor = v ? `rgba(99,102,241,${(0.15 + 0.85 * (v / pico)).toFixed(3)})` : "#f1f5f9";
              const cls = `aspect-square flex-1 rounded-[2px] ${ativo ? "ring-2 ring-slate-800" : ""}`;
              const title = `${DIAS[d]} ${String(hora).padStart(2, "0")}h — ${v}`;
              return ranking ? (
                <button key={hora} type="button" title={title} aria-label={title} onClick={() => setSel(ativo ? null : { d, h: hora })} className={`${cls} cursor-pointer transition hover:ring-2 hover:ring-indigo-400`} style={{ backgroundColor: cor }} />
              ) : (
                <span key={hora} title={title} className={cls} style={{ backgroundColor: cor }} />
              );
            })}
          </div>
        ))}
      </div>

      {ranking && !sel && <p className="mt-2 text-[11px] text-slate-400">Clique num quadradinho para ver quem mais produz naquele horário.</p>}
      {sel && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Ranking · {DIAS_LONGO[sel.d]}, {String(sel.h).padStart(2, "0")}h–{String((sel.h + 1) % 24).padStart(2, "0")}h</h4>
              <p className="text-[11px] text-slate-400">{total} no total neste horário (somando todas as semanas do período)</p>
            </div>
            <button type="button" onClick={() => setSel(null)} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600">Fechar</button>
          </div>
          {lista.length === 0 ? <p className="py-3 text-center text-xs text-slate-400">Ninguém produziu neste horário.</p> : (
            <ol className="space-y-1.5">
              {lista.map((x, i) => (
                <li key={x.nome + i} className="flex items-center gap-3 text-sm">
                  <span className="w-6 text-xs font-semibold tabular-nums text-slate-400">{i + 1}º</span>
                  <span className="w-40 truncate text-slate-700">{x.nome}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(3, (x.qtd / max) * 100)}%` }} /></div>
                  <span className="w-10 text-right text-sm font-semibold tabular-nums text-slate-800">{x.qtd}</span>
                  <span className="w-9 text-right text-[11px] tabular-nums text-slate-400">{Math.round((x.qtd / total) * 100)}%</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
