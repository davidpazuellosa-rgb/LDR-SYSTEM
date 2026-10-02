"use client";

import { useMemo, useState } from "react";
import { apiPath } from "@/lib/path";
import type { Producao } from "@/lib/producao";
import HorariosView from "@/components/HorariosView";
import DataTable from "@/components/DataTable";
import ExportColunasButton from "@/components/ExportColunasButton";
import { EXPORT_COLS } from "@/lib/export-cols";

const CARD = "rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm";
const TITLE = "text-[13px] font-semibold text-slate-700";
const SUB = "text-[11px] text-slate-400";
const COR_P = "#6366f1"; // preenchimento
const COR_C = "#10b981"; // correção
const nf = (n: number) => n.toLocaleString("pt-BR");

const STATUS = {
  ok: { label: "No ritmo", chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" },
  risco: { label: "Em risco", chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500" },
  atrasado: { label: "Atrasado", chip: "bg-rose-50 text-rose-600", bar: "bg-rose-500" },
} as const;

function Var({ v }: { v: number | null }) {
  if (v === null) return <span className="text-[11px] text-slate-400">novo no período</span>;
  const up = v >= 0;
  return (
    <span className={`text-[11px] font-medium ${up ? "text-emerald-600" : "text-rose-500"}`}>
      {up ? "↑" : "↓"} {Math.abs(v)}% <span className="font-normal text-slate-400">vs. anterior</span>
    </span>
  );
}

function Legenda() {
  return (
    <div className="flex gap-3 text-[10px] text-slate-400">
      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: COR_P }} /> Preenchimento</span>
      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: COR_C }} /> Correção</span>
    </div>
  );
}

// Barras verticais empilhadas por dia/semana, com tooltip ao passar o mouse.
function GraficoDias({ dias }: { dias: Producao["dias"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...dias.map((d) => d.preenchimento + d.correcao));
  const passo = Math.ceil(dias.length / 8);
  const H = 130;
  return (
    <div className="relative">
      <div className="flex items-end gap-[3px]" style={{ height: H }}>
        {dias.map((d, i) => {
          const hp = (d.preenchimento / max) * (H - 8);
          const hc = (d.correcao / max) * (H - 8);
          return (
            <div key={d.chave} className="relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-[11px] text-white shadow-lg">
                  {d.label}: {nf(d.preenchimento + d.correcao)} <span className="text-slate-300">({d.preenchimento}p · {d.correcao}c)</span>
                </div>
              )}
              <div className="w-full rounded-t-[3px]" style={{ height: hc, background: COR_C }} />
              <div className="w-full" style={{ height: hp, background: COR_P, borderRadius: hc ? 0 : "3px 3px 0 0" }} />
              {d.preenchimento + d.correcao === 0 && <div className="h-[2px] w-full rounded bg-slate-200" />}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px] text-[10px] text-slate-400">
        {dias.map((d, i) => (
          <span key={d.chave} className="relative h-3 flex-1">
            {i % passo === 0 && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{d.label}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarraEmpilhada({ p, c, max }: { p: number; c: number; max: number }) {
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full" style={{ width: `${(p / max) * 100}%`, background: COR_P }} />
      <div className="h-full" style={{ width: `${(c / max) * 100}%`, background: COR_C }} />
    </div>
  );
}

type Ordem = "producao" | "nome" | "meta" | "feito" | "p" | "preenchimento" | "correcao";

export default function ProducaoView({ data, query }: { data: Producao; query: string }) {
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("producao");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [aberto, setAberto] = useState<string | null>(null);

  const k = data.kpis;
  const maxPessoa = Math.max(1, ...data.linhas.map((l) => l.producao.total));
  const maxEstado = Math.max(1, ...data.porEstado.map((e) => e.total));
  const maxCamp = Math.max(1, ...data.porCampanha.map((e) => e.total));

  const linhas = useMemo(() => {
    const n = busca.trim().toLowerCase();
    const val = (l: (typeof data.linhas)[number]) =>
      ordem === "nome" ? l.nome.toLowerCase()
      : ordem === "meta" ? l.meta
      : ordem === "feito" ? l.feitoMeta
      : ordem === "p" ? (l.temMeta ? l.p : -1)
      : ordem === "preenchimento" ? l.producao.preenchimento
      : ordem === "correcao" ? l.producao.correcao
      : l.producao.total;
    return data.linhas
      .filter((l) => !n || l.nome.toLowerCase().includes(n))
      .sort((a, b) => {
        const x = val(a), y = val(b);
        return (x < y ? -1 : x > y ? 1 : 0) * dir;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.linhas, busca, ordem, dir]);

  const totalMeta = data.linhas.reduce((a, l) => a + l.meta, 0);
  const totalFeitoMeta = data.linhas.reduce((a, l) => a + l.feitoMeta, 0);

  function ordenar(o: Ordem) {
    if (ordem === o) setDir((d) => (d === 1 ? -1 : 1));
    else { setOrdem(o); setDir(o === "nome" ? 1 : -1); }
  }
  const Th = ({ o, children, right }: { o: Ordem; children: React.ReactNode; right?: boolean }) => (
    <th className={`px-3 py-2 font-medium ${right ? "text-right" : "text-left"}`}>
      <button type="button" onClick={() => ordenar(o)} className={`inline-flex items-center gap-1 hover:text-slate-700 ${ordem === o ? "text-indigo-600" : ""}`}>
        {children}
        {ordem === o && <span>{dir === 1 ? "▲" : "▼"}</span>}
      </button>
    </th>
  );

  const exportHref = (tipo: string) => apiPath(`/api/relatorios/producao/export?tipo=${tipo}${query ? `&${query}` : ""}`);
  const pessoaAberta = aberto ? data.linhas.find((l) => l.id === aberto) : null;
  const det = aberto ? data.detalhe[aberto] : null;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className={CARD}>
          <div className="text-2xl font-semibold tabular-nums text-slate-900">{nf(k.total.total)}</div>
          <div className="mt-0.5 text-xs text-slate-500">Total produzido</div>
          <div className="mt-1"><Var v={k.varTotal} /></div>
        </div>
        <div className={CARD}>
          <div className="text-2xl font-semibold tabular-nums" style={{ color: COR_P }}>{nf(k.total.preenchimento)}</div>
          <div className="mt-0.5 text-xs text-slate-500">Preenchidas</div>
          <div className="mt-1"><Var v={k.varPreench} /></div>
        </div>
        <div className={CARD}>
          <div className="text-2xl font-semibold tabular-nums" style={{ color: COR_C }}>{nf(k.total.correcao)}</div>
          <div className="mt-0.5 text-xs text-slate-500">Corrigidas</div>
          <div className="mt-1"><Var v={k.varCorr} /></div>
        </div>
        <div className={CARD}>
          <div className="text-2xl font-semibold tabular-nums text-slate-900">{k.metasBatidas}<span className="text-base font-normal text-slate-400"> / {k.totalMetas}</span></div>
          <div className="mt-0.5 text-xs text-slate-500">Metas batidas</div>
        </div>
        <div className={CARD}>
          <div className="text-2xl font-semibold tabular-nums text-slate-900">{k.pctMetas === null ? "—" : `${k.pctMetas}%`}</div>
          <div className="mt-0.5 text-xs text-slate-500">das metas atingidas</div>
          {k.pctMetas !== null && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, k.pctMetas)}%` }} /></div>
          )}
        </div>
      </section>

      {/* Dias + Pessoas */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={CARD}>
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h2 className={TITLE}>Produção por {data.dias.length > 62 ? "semana" : "dia"}</h2>
              <p className={SUB}>Preenchimento + correção no período</p>
            </div>
            <Legenda />
          </div>
          {k.total.total === 0 ? <p className="py-10 text-center text-xs text-slate-400">Nenhuma produção no período/filtros.</p> : <GraficoDias dias={data.dias} />}
        </div>

        <div className={CARD}>
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h2 className={TITLE}>Produção por pessoa</h2>
              <p className={SUB}>Clique numa pessoa para ver o detalhe</p>
            </div>
            <Legenda />
          </div>
          {data.linhas.length === 0 ? <p className="py-10 text-center text-xs text-slate-400">Nenhuma pessoa para o filtro.</p> : (
            <div className="max-h-[210px] space-y-2.5 overflow-y-auto pr-1">
              {[...data.linhas].sort((a, b) => b.producao.total - a.producao.total).map((l) => (
                <button key={l.id} type="button" onClick={() => setAberto(l.id)} className="block w-full rounded-md text-left hover:bg-slate-50">
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate text-slate-600">{l.nome}</span>
                    <span className="shrink-0 tabular-nums text-slate-400"><span className="font-semibold text-slate-700">{nf(l.producao.total)}</span> ({l.producao.preenchimento}p · {l.producao.correcao}c)</span>
                  </div>
                  <BarraEmpilhada p={l.producao.preenchimento} c={l.producao.correcao} max={maxPessoa} />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Meta × Realizado + Estados */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={CARD}>
          <h2 className={TITLE}>Meta × Realizado por pessoa</h2>
          <p className={`mb-3 ${SUB}`}>Meta proporcional ao período · a marca cinza é o ritmo esperado</p>
          {data.linhas.filter((l) => l.temMeta).length === 0 ? <p className="py-8 text-center text-xs text-slate-400">Nenhuma meta para os filtros atuais.</p> : (
            <div className="max-h-[260px] space-y-3 overflow-y-auto pr-1">
              {data.linhas.filter((l) => l.temMeta).sort((a, b) => b.p - a.p).map((l) => {
                const st = STATUS[l.status || "ok"];
                const esperado = l.metas.reduce((a, m) => a + m.esperado, 0);
                const esperadoPct = l.meta > 0 ? Math.min(100, (esperado / l.meta) * 100) : 0;
                return (
                  <button key={l.id} type="button" onClick={() => setAberto(l.id)} className="block w-full text-left">
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-medium text-slate-700">{l.nome}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tabular-nums text-slate-400">{nf(l.feitoMeta)}/{nf(l.meta)} · {l.p}%</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${st.chip}`}>{st.label}</span>
                      </span>
                    </div>
                    <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${Math.max(2, Math.min(100, l.p))}%` }} />
                      <span className="absolute top-0 h-full w-px bg-slate-500" style={{ left: `${esperadoPct}%` }} title={`Esperado: ${nf(esperado)}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={CARD}>
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h2 className={TITLE}>Produção por estado</h2>
              <p className={SUB}>Top 10 estados no período</p>
            </div>
            <Legenda />
          </div>
          {data.porEstado.length === 0 ? <p className="py-8 text-center text-xs text-slate-400">Sem dados.</p> : (
            <div className="space-y-2">
              {data.porEstado.slice(0, 10).map((e) => (
                <div key={e.uf} className="flex items-center gap-3">
                  <span className="w-7 text-xs font-semibold text-slate-600">{e.uf}</span>
                  <div className="flex-1"><BarraEmpilhada p={e.preenchimento} c={e.correcao} max={maxEstado} /></div>
                  <span className="w-12 text-right text-xs tabular-nums text-slate-500">{nf(e.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {data.porCampanha.length > 0 && (
        <section className={CARD}>
          <h2 className={TITLE}>Por campanha</h2>
          <p className={`mb-3 ${SUB}`}>Produção agrupada pela campanha do contato</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.porCampanha.map((c) => (
              <div key={c.campanha} className="flex items-center gap-3">
                <span className="w-40 truncate text-xs text-slate-600" title={c.campanha}>{c.campanha}</span>
                <div className="flex-1"><BarraEmpilhada p={c.preenchimento} c={c.correcao} max={maxCamp} /></div>
                <span className="w-12 text-right text-xs tabular-nums text-slate-500">{nf(c.total)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tabela */}
      <section className={CARD}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={TITLE}>Produção por pessoa</h2>
            <p className={SUB}>{linhas.length} pessoa(s) · clique numa linha para abrir o detalhe</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5">
              <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></svg>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa" className="w-40 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" />
            </div>
            <ExportColunasButton href={exportHref("pessoas")} colunas={EXPORT_COLS.pessoas} titulo="Exportar resumo" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Exportar resumo</ExportColunasButton>
            <ExportColunasButton href={exportHref("detalhe")} colunas={EXPORT_COLS.detalhe} titulo="Exportar detalhado" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Exportar detalhado</ExportColunasButton>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-400">
              <tr>
                <Th o="nome">Pessoa</Th>
                <Th o="meta" right>Meta</Th>
                <Th o="feito" right>Feito (meta)</Th>
                <Th o="p" right>% da meta</Th>
                <Th o="preenchimento" right>Preench.</Th>
                <Th o="correcao" right>Corrig.</Th>
                <Th o="producao" right>Total</Th>
                <th className="px-3 py-2 text-left font-medium">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {linhas.map((l) => (
                <tr key={l.id} onClick={() => setAberto(l.id)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-700">{l.nome}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{l.temMeta ? nf(l.meta) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{l.temMeta ? nf(l.feitoMeta) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{l.temMeta ? `${l.p}%` : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: COR_P }}>{nf(l.producao.preenchimento)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: COR_C }}>{nf(l.producao.correcao)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">{nf(l.producao.total)}</td>
                  <td className="px-3 py-2.5">{l.status ? <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[l.status].chip}`}>{STATUS[l.status].label}</span> : <span className="text-xs text-slate-300">sem meta</span>}</td>
                </tr>
              ))}
              {linhas.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">Nenhuma pessoa encontrada.</td></tr>}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
              <tr>
                <td className="px-3 py-2.5">Total da equipe</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{nf(totalMeta)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{nf(totalFeitoMeta)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{totalMeta > 0 ? `${Math.round((totalFeitoMeta / totalMeta) * 100)}%` : "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: COR_P }}>{nf(k.total.preenchimento)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: COR_C }}>{nf(k.total.correcao)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{nf(k.total.total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Comparativo: produção por pessoa × dia (intensidade da cor) */}
      {data.linhas.length > 0 && k.total.total > 0 && (
        <section className={CARD}>
          <h2 className={TITLE}>Comparativo da equipe por {data.dias.length > 62 ? "semana" : "dia"}</h2>
          <p className={`mb-3 ${SUB}`}>Cada linha é uma pessoa; quanto mais escura a célula, mais ela produziu naquele dia</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-[2px] text-[10px]">
              <thead>
                <tr>
                  <th className="w-40 text-left font-medium text-slate-400" />
                  {data.dias.map((d, i) => <th key={d.chave} className="font-normal text-slate-400">{i % Math.ceil(data.dias.length / 12) === 0 ? d.label : ""}</th>)}
                  <th className="pl-2 text-right font-medium text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...data.linhas].sort((a, b) => b.producao.total - a.producao.total).map((l) => {
                  const dias = data.detalhe[l.id]?.dias ?? [];
                  const pico = Math.max(1, ...dias.map((x) => x.preenchimento + x.correcao));
                  return (
                    <tr key={l.id}>
                      <td className="max-w-[10rem] truncate pr-2 text-left text-xs text-slate-600">{l.nome}</td>
                      {dias.map((x) => {
                        const v = x.preenchimento + x.correcao;
                        return <td key={x.chave} title={`${l.nome} · ${x.label}: ${v}`} className="h-5 rounded-[3px]" style={{ backgroundColor: v ? `rgba(99,102,241,${(0.15 + 0.85 * (v / pico)).toFixed(3)})` : "#f1f5f9" }} />;
                      })}
                      <td className="pl-2 text-right text-xs font-semibold tabular-nums text-slate-700">{nf(l.producao.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Horários: equipe (conforme os filtros) + comparativo por pessoa */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={CARD}>
          <h2 className={TITLE}>Horários de produção · seleção atual</h2>
          <p className={`mb-3 ${SUB}`}>Horário de Brasília · quando a linha ficou completa / correção resolvida</p>
          <HorariosView h={data.horarios} compacto />
        </div>
        <div className={CARD}>
          <h2 className={TITLE}>Quando cada pessoa mais produz</h2>
          <p className={`mb-3 ${SUB}`}>Comparativo de horários, dia e turno</p>
          <DataTable
            maxHeight={420}
            searchKeys={["nome"]}
            searchPlaceholder="Buscar pessoa"
            csvName="horarios-por-pessoa"
            empty="Nenhuma pessoa."
            defaultSort={{ key: "total", dir: -1 }}
            cols={[
              { key: "nome", label: "Pessoa", kind: "text" },
              { key: "total", label: "Total", kind: "num" },
              { key: "janela", label: "Melhor janela", kind: "text" },
              { key: "dia", label: "Melhor dia", kind: "text" },
              { key: "turno", label: "Turno", kind: "text" },
            ]}
            rows={data.linhas.map((l) => {
              const h = data.horariosPorPessoa[l.id];
              const t = h && h.total ? Object.entries(h.turnos).sort((a, b) => b[1] - a[1])[0][0] : null;
              return {
                nome: l.nome,
                total: h?.total ?? 0,
                janela: h?.melhorJanela ? `${String(h.melhorJanela.de).padStart(2, "0")}h–${String(h.melhorJanela.ate).padStart(2, "0")}h` : null,
                dia: h?.melhorDia?.nome ?? null,
                turno: t ? ({ madrugada: "Madrugada", manha: "Manhã", tarde: "Tarde", noite: "Noite" } as Record<string, string>)[t] : null,
              };
            })}
          />
        </div>
      </section>

      {/* Painel de detalhe */}
      {pessoaAberta && det && (
        <div className="fixed inset-0 z-[80] flex justify-end bg-slate-900/40" onMouseDown={(e) => e.target === e.currentTarget && setAberto(null)}>
          <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-indigo-100 font-bold text-indigo-700">{pessoaAberta.nome.charAt(0).toUpperCase()}</span>
                <div>
                  <h3 className="font-semibold text-slate-800">{pessoaAberta.nome}</h3>
                  <p className="text-xs text-slate-400">{nf(pessoaAberta.producao.total)} no período · {pessoaAberta.producao.preenchimento}p · {pessoaAberta.producao.correcao}c</p>
                </div>
              </div>
              <button onClick={() => setAberto(null)} aria-label="Fechar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
              <div>
                <div className="mb-2 flex items-center justify-between"><h4 className={TITLE}>Por {data.dias.length > 62 ? "semana" : "dia"}</h4><Legenda /></div>
                {pessoaAberta.producao.total === 0 ? <p className="py-4 text-center text-xs text-slate-400">Sem produção no período.</p> : <GraficoDias dias={det.dias} />}
              </div>
              <div>
                <h4 className={`mb-2 ${TITLE}`}>Metas</h4>
                {pessoaAberta.metas.length === 0 ? <p className="text-xs text-slate-400">Esta pessoa não tem metas para os filtros atuais.</p> : (
                  <div className="space-y-3">
                    {pessoaAberta.metas.map((m) => {
                      const st = STATUS[m.status];
                      return (
                        <div key={m.id}>
                          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate text-slate-600">{m.rotulo}</span>
                            <span className="flex shrink-0 items-center gap-1.5"><span className="tabular-nums text-slate-400">{m.feito}/{m.meta} · {m.p}%</span><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${st.chip}`}>{st.label}</span></span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${st.bar}`} style={{ width: `${Math.max(2, Math.min(100, m.p))}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {data.horariosPorPessoa[pessoaAberta.id] && (
                <div>
                  <h4 className={`mb-2 ${TITLE}`}>Horários</h4>
                  <HorariosView h={data.horariosPorPessoa[pessoaAberta.id]} compacto />
                </div>
              )}
              {det.estados.length > 0 && (
                <div>
                  <h4 className={`mb-2 ${TITLE}`}>Por estado</h4>
                  <div className="space-y-2">
                    {det.estados.map((e) => (
                      <div key={e.uf} className="flex items-center gap-3">
                        <span className="w-7 text-xs font-semibold text-slate-600">{e.uf}</span>
                        <div className="flex-1"><BarraEmpilhada p={e.preenchimento} c={e.correcao} max={det.estados[0].total} /></div>
                        <span className="w-10 text-right text-xs tabular-nums text-slate-500">{nf(e.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {det.campanhas.length > 0 && (
                <div>
                  <h4 className={`mb-2 ${TITLE}`}>Por campanha</h4>
                  <div className="space-y-2">
                    {det.campanhas.map((c) => (
                      <div key={c.campanha} className="flex items-center gap-3">
                        <span className="w-32 truncate text-xs text-slate-600" title={c.campanha}>{c.campanha}</span>
                        <div className="flex-1"><BarraEmpilhada p={c.preenchimento} c={c.correcao} max={det.campanhas[0].total} /></div>
                        <span className="w-10 text-right text-xs tabular-nums text-slate-500">{nf(c.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
