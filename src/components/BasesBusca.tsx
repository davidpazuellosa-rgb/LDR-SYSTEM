"use client";

import { useMemo, useState, type ReactNode } from "react";
import Dropdown from "@/components/Dropdown";

export type BaseItem = {
  key: string;
  nome: string;
  situacao: string; // rótulo do tier (Concluído, Quase lá…)
  pct: number;
  total: number;
  planilhas: number;
  node: ReactNode;
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const SITUACOES = ["Concluído", "Quase lá", "Em andamento", "Não iniciado"].map((s) => ({ value: s, label: s }));
const CONTATOS = [
  { value: "com", label: "Com contatos" },
  { value: "sem", label: "Sem contatos" },
];
const ORDENS = [
  { value: "padrao", label: "Ordem padrão" },
  { value: "nome", label: "Nome (A–Z)" },
  { value: "pct-desc", label: "Maior progresso" },
  { value: "pct-asc", label: "Menor progresso" },
  { value: "contatos", label: "Mais contatos" },
  { value: "planilhas", label: "Mais planilhas" },
];

// Barra de busca + botão "Filtros" que abre um card com filtros em dropdown.
// Filtra no cliente (poucos cards) — os cards em si vêm prontos do servidor.
export default function BasesBusca({ itens, nenhum }: { itens: BaseItem[]; nenhum: ReactNode }) {
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState(false);
  const [sit, setSit] = useState<string[]>([]);
  const [cont, setCont] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<string[]>(["padrao"]);

  const ativos = (sit.length ? 1 : 0) + (cont.length ? 1 : 0) + (ordem[0] && ordem[0] !== "padrao" ? 1 : 0);

  const lista = useMemo(() => {
    const n = norm(q.trim());
    let r = itens.filter((i) => {
      if (n && !norm(i.nome).includes(n)) return false;
      if (sit.length && !sit.includes(i.situacao)) return false;
      if (cont.length && !cont.includes(i.total > 0 ? "com" : "sem")) return false;
      return true;
    });
    const o = ordem[0] ?? "padrao";
    if (o !== "padrao") {
      r = [...r].sort((a, b) =>
        o === "nome" ? a.nome.localeCompare(b.nome)
        : o === "pct-desc" ? b.pct - a.pct
        : o === "pct-asc" ? a.pct - b.pct
        : o === "contatos" ? b.total - a.total
        : b.planilhas - a.planilhas
      );
    }
    return r;
  }, [itens, q, sit, cont, ordem]);

  const limpar = () => { setQ(""); setSit([]); setCont([]); setOrdem(["padrao"]); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar órgão…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${aberto || ativos ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5h18M6 12h12M10 19h4" strokeLinecap="round" />
          </svg>
          Filtros
          {ativos > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-xs text-white">{ativos}</span>}
        </button>
      </div>

      {aberto && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Campo titulo="Situação"><Dropdown label="Todas" options={SITUACOES} value={sit} onChange={setSit} multi searchable={false} /></Campo>
            <Campo titulo="Contatos"><Dropdown label="Todos" options={CONTATOS} value={cont} onChange={setCont} multi searchable={false} /></Campo>
            <Campo titulo="Ordenar por"><Dropdown label="Ordem padrão" options={ORDENS} value={ordem} onChange={(v) => setOrdem(v.length ? [v[v.length - 1]] : ["padrao"])} searchable={false} /></Campo>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={limpar} className="text-sm font-medium text-indigo-600 hover:underline">Limpar filtros</button>
          </div>
        </div>
      )}

      {itens.length === 0 ? nenhum : lista.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
          Nenhum órgão encontrado.{" "}
          <button type="button" onClick={limpar} className="font-medium text-indigo-600 hover:underline">Limpar filtros</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((i) => <div key={i.key} className="contents">{i.node}</div>)}
        </div>
      )}
    </div>
  );
}

function Campo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-500">{titulo}</div>
      {children}
    </div>
  );
}
