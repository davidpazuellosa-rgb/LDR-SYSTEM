"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useVisao, VisaoToggle, ThSort, proximaOrd, type Ord } from "@/components/ListaUtils";
import Dropdown from "@/components/Dropdown";
import { BotaoFiltros } from "@/components/FiltrosCard";

export type BaseItem = {
  key: string;
  nome: string;
  situacao: string; // rótulo do tier (Concluído, Quase lá…)
  pct: number;
  total: number;
  planilhas: number;
  done: number; // linhas completas
  val?: { sim: number; nao: number; aValidar: number }; // validação (só se houver planilha validada)
  href: string;
  cor: { bar: string; text: string; chip: string }; // classes da faixa de progresso
  menu: ReactNode; // menu ⋯ (editar nome / apagar)
  node: ReactNode; // cartão pronto (visão em cards)
};

const nf = (n: number) => n.toLocaleString("pt-BR");

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
export default function BasesBusca({ itens, nenhum, resumo, acoes }: { itens: BaseItem[]; nenhum: ReactNode; resumo: ReactNode; acoes?: ReactNode }) {
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState(false);
  const [sit, setSit] = useState<string[]>([]);
  const [cont, setCont] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<string[]>(["padrao"]);
  // Formato de visualização (cards ou lista): lembrado neste navegador, vale nos dois níveis.
  const [visao, escolher] = useVisao();
  // Ordenação por clique no cabeçalho da lista (sobrepõe o "Ordenar por" dos filtros).
  const [ord, setOrd] = useState<Ord>(null);

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

  const RANK: Record<string, number> = { "Não iniciado": 0, "Em andamento": 1, "Quase lá": 2, "Concluído": 3 };
  const listaTabela = useMemo(() => {
    if (!ord) return lista;
    const valor = (i: BaseItem): string | number =>
      ord.k === "nome" ? i.nome.toLowerCase()
      : ord.k === "planilhas" ? i.planilhas
      : ord.k === "contatos" ? i.total
      : ord.k === "pct" ? i.pct
      : ord.k === "situacao" ? RANK[i.situacao] ?? 0
      : i.val && i.val.sim + i.val.nao + i.val.aValidar > 0 ? (i.val.sim + i.val.nao) / (i.val.sim + i.val.nao + i.val.aValidar) : -1;
    return [...lista].sort((a, b) => {
      const x = valor(a), y = valor(b);
      return (x < y ? -1 : x > y ? 1 : a.nome.localeCompare(b.nome)) * ord.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, ord]);

  const limpar = () => { setQ(""); setSit([]); setCont([]); setOrdem(["padrao"]); };

  return (
    <div className="space-y-4">
      {/* Uma linha só, no mesmo nível dos outros botões: resumo à esquerda; busca, Filtros e ações à direita */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{resumo}</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <svg className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar órgão…"
              aria-label="Buscar órgão"
              className="h-9 w-48 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none transition focus:w-60 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <BotaoFiltros aberto={aberto} ativos={ativos} onClick={() => setAberto((v) => !v)} />
          <VisaoToggle visao={visao} onChange={escolher} />
          {acoes}
        </div>
      </div>

      {aberto && (
        <div className="ml-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
        visao === "cards" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {lista.map((i) => <div key={i.key} className="contents">{i.node}</div>)}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <ThSort k="nome" ord={ord} onSort={(k) => setOrd(proximaOrd(ord, k))} className="!px-5">Órgão</ThSort>
                  <ThSort k="planilhas" ord={ord} onSort={(k) => setOrd(proximaOrd(ord, k))} direita>Planilhas</ThSort>
                  <ThSort k="contatos" ord={ord} onSort={(k) => setOrd(proximaOrd(ord, k))} direita>Contatos</ThSort>
                  <ThSort k="pct" ord={ord} onSort={(k) => setOrd(proximaOrd(ord, k))}>Preenchimento</ThSort>
                  <ThSort k="situacao" ord={ord} onSort={(k) => setOrd(proximaOrd(ord, k))}>Situação</ThSort>
                  <ThSort k="valid" ord={ord} onSort={(k) => setOrd(proximaOrd(ord, k))}>Validados</ThSort>
                  <th className="w-40 px-3 py-3" />
                  <th className="w-14 px-1 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {listaTabela.map((i) => {
                  const feitos = i.val ? i.val.sim + i.val.nao : 0;
                  const totVal = i.val ? i.val.sim + i.val.nao + i.val.aValidar : 0;
                  return (
                    <tr key={i.key} className="group hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <Link href={i.href} className="font-semibold text-slate-800 hover:text-indigo-600">{i.nome}</Link>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">{nf(i.planilhas)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">{nf(i.total)}</td>
                      <td className="px-3 py-3">
                        {i.total > 0 ? (
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
                              <div className={`h-full rounded-full ${i.cor.bar}`} style={{ width: `${Math.max(2, i.pct)}%` }} />
                            </div>
                            <span className={`w-10 text-right font-semibold tabular-nums ${i.cor.text}`}>{i.pct}%</span>
                            <span className="text-xs tabular-nums text-slate-400">{nf(i.done)} de {nf(i.total)}</span>
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${i.cor.chip}`}>{i.situacao}</span></td>
                      <td className="px-3 py-3 text-xs">
                        {i.val && totVal > 0 ? (
                          <span className="tabular-nums text-slate-500">
                            <strong className="text-slate-700">{Math.round((feitos / totVal) * 100)}%</strong>{" "}
                            · <span className="text-emerald-700">{nf(i.val.sim)} Sim</span> · <span className="text-red-600">{nf(i.val.nao)} Não</span> · {nf(i.val.aValidar)} a validar
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link href={i.href} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:gap-1.5">
                          Ver regiões
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </Link>
                      </td>
                      <td className="relative px-1 py-3">{i.menu}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
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
