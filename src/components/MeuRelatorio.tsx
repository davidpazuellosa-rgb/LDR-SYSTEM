import Link from "next/link";
import DataTable from "@/components/DataTable";
import { PRESET_LABEL, type Preset } from "@/lib/producao-calc";
import type { buildMeuRelatorio, LinhaRanking } from "@/lib/producao";

type Meu = Awaited<ReturnType<typeof buildMeuRelatorio>>;
const CARD = "rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm";
const TITLE = "text-[13px] font-semibold text-slate-700";
const SUB = "text-[11px] text-slate-400";
const nf = (n: number) => n.toLocaleString("pt-BR");
const PRESETS_LDR: Preset[] = ["hoje", "7d", "30d", "mes", "mes-passado"];

export type Aba = "desempenho" | "horarios" | "ranking" | "correcoes";
export const ABAS: { v: Aba; label: string }[] = [
  { v: "desempenho", label: "Meu desempenho" },
  { v: "horarios", label: "Meus horários" },
  { v: "ranking", label: "Ranking" },
  { v: "correcoes", label: "Correções" },
];

export function AbasLinks({ ativa, periodo }: { ativa: Aba; periodo: Preset }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200">
      {ABAS.map((a) => (
        <Link
          key={a.v}
          href={`/relatorio?aba=${a.v}${periodo !== "7d" ? `&periodo=${periodo}` : ""}`}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${ativa === a.v ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
        >
          {a.label}
        </Link>
      ))}
    </div>
  );
}

export function PeriodoLinks({ aba, periodo }: { aba: Aba; periodo: Preset }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-0.5">
      {PRESETS_LDR.map((p) => (
        <Link
          key={p}
          href={`/relatorio?aba=${aba}${p !== "7d" ? `&periodo=${p}` : ""}`}
          className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${periodo === p ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800"}`}
        >
          {PRESET_LABEL[p]}
        </Link>
      ))}
    </div>
  );
}

function Var({ v }: { v: number | null }) {
  if (v === null) return <span className="text-[11px] text-slate-400">novo no período</span>;
  return (
    <span className={`text-[11px] font-medium ${v >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
      {v >= 0 ? "↑" : "↓"} {Math.abs(v)}% <span className="font-normal text-slate-400">vs. anterior</span>
    </span>
  );
}

export function MeuDesempenho({ d }: { d: Meu }) {
  const k = d.kpis;
  const max = Math.max(1, ...d.dias.map((x) => x.preenchimento + x.correcao));
  const passo = Math.ceil(d.dias.length / 8);
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={CARD}><div className="text-2xl font-semibold tabular-nums text-slate-900">{nf(k.total.total)}</div><div className="mt-0.5 text-xs text-slate-500">Total produzido</div><div className="mt-1"><Var v={k.varTotal} /></div></div>
        <div className={CARD}><div className="text-2xl font-semibold tabular-nums text-indigo-500">{nf(k.total.preenchimento)}</div><div className="mt-0.5 text-xs text-slate-500">Preenchidas</div><div className="mt-1"><Var v={k.varPreench} /></div></div>
        <div className={CARD}><div className="text-2xl font-semibold tabular-nums text-emerald-500">{nf(k.total.correcao)}</div><div className="mt-0.5 text-xs text-slate-500">Corrigidas</div><div className="mt-1"><Var v={k.varCorr} /></div></div>
        <div className={CARD}>
          <div className="text-2xl font-semibold tabular-nums text-slate-900">{k.pctMetas === null ? "—" : `${k.pctMetas}%`}</div>
          <div className="mt-0.5 text-xs text-slate-500">das minhas metas · {k.metasBatidas}/{k.totalMetas} batidas</div>
          {k.pctMetas !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, k.pctMetas)}%` }} /></div>}
        </div>
      </section>

      <section className={CARD}>
        <h2 className={TITLE}>Minha produção por {d.dias.length > 62 ? "semana" : "dia"}</h2>
        <p className={`mb-3 ${SUB}`}><span className="text-indigo-500">●</span> preenchimento · <span className="text-emerald-500">●</span> correção</p>
        {k.total.total === 0 ? <p className="py-8 text-center text-xs text-slate-400">Nenhuma produção no período.</p> : (
          <>
            <div className="flex h-32 items-end gap-[3px]">
              {d.dias.map((x) => (
                <div key={x.chave} className="flex h-full flex-1 flex-col justify-end" title={`${x.label}: ${x.preenchimento + x.correcao} (${x.preenchimento}p · ${x.correcao}c)`}>
                  <div className="w-full rounded-t-[3px] bg-emerald-500" style={{ height: `${(x.correcao / max) * 92}%` }} />
                  <div className="w-full bg-indigo-500" style={{ height: `${(x.preenchimento / max) * 92}%`, borderRadius: x.correcao ? 0 : "3px 3px 0 0" }} />
                  {x.preenchimento + x.correcao === 0 && <div className="h-[2px] w-full rounded bg-slate-200" />}
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-[3px] text-[10px] text-slate-400">
              {d.dias.map((x, i) => <span key={x.chave} className="relative h-3 flex-1">{i % passo === 0 && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{x.label}</span>}</span>)}
            </div>
          </>
        )}
      </section>

      <section className={CARD}>
        <h2 className={TITLE}>Minhas metas × realizado</h2>
        <p className={`mb-3 ${SUB}`}>Meta ajustada ao período escolhido</p>
        <DataTable
          maxHeight={300}
          empty="Você não tem metas neste período."
          cols={[
            { key: "rotulo", label: "Meta", kind: "text" },
            { key: "feito", label: "Feito", kind: "num" },
            { key: "meta", label: "Alvo", kind: "num" },
            { key: "p", label: "%", kind: "pct", ok: 100, meio: 60 },
            { key: "status", label: "Situação", kind: "status" },
          ]}
          rows={d.metas.map((m) => ({ rotulo: m.rotulo, feito: m.feito, meta: m.meta, p: m.p, status: m.status }))}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={CARD}>
          <h2 className={`mb-3 ${TITLE}`}>Por estado</h2>
          <DataTable maxHeight={280} empty="Sem dados." cols={[{ key: "uf", label: "UF", kind: "text" }, { key: "preenchimento", label: "Preench.", kind: "num" }, { key: "correcao", label: "Corrig.", kind: "num" }, { key: "total", label: "Total", kind: "num" }]} rows={d.porEstado.map((e) => ({ ...e }))} defaultSort={{ key: "total", dir: -1 }} />
        </div>
        <div className={CARD}>
          <h2 className={`mb-3 ${TITLE}`}>Por campanha</h2>
          <DataTable maxHeight={280} empty="Sem dados." cols={[{ key: "campanha", label: "Campanha", kind: "text" }, { key: "preenchimento", label: "Preench.", kind: "num" }, { key: "correcao", label: "Corrig.", kind: "num" }, { key: "total", label: "Total", kind: "num" }]} rows={d.porCampanha.map((e) => ({ ...e }))} defaultSort={{ key: "total", dir: -1 }} />
        </div>
      </section>
    </div>
  );
}

// Ranking: SÓ posição, nome e total — nada mais dos colegas.
export function RankingTabela({ linhas, meId }: { linhas: LinhaRanking[]; meId: string }) {
  const max = Math.max(1, ...linhas.map((l) => l.total));
  const eu = linhas.find((l) => l.id === meId);
  return (
    <section className={CARD}>
      <h2 className={TITLE}>Ranking da equipe</h2>
      <p className={`mb-3 ${SUB}`}>Total produzido no período (preenchidas + corrigidas){eu ? ` · você está em ${eu.posicao}º` : ""}</p>
      {linhas.length === 0 ? <p className="py-6 text-center text-xs text-slate-400">Sem dados.</p> : (
        <div className="divide-y divide-slate-50">
          {linhas.map((l) => (
            <div key={l.id} className={`flex items-center gap-3 px-2 py-2 ${l.id === meId ? "rounded-lg bg-indigo-50/70" : ""}`}>
              <span className="w-7 text-sm font-semibold tabular-nums text-slate-400">{l.posicao}º</span>
              <span className={`w-44 truncate text-sm ${l.id === meId ? "font-semibold text-indigo-700" : "text-slate-700"}`}>{l.nome}{l.id === meId ? " (você)" : ""}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${l.id === meId ? "bg-indigo-600" : "bg-indigo-300"}`} style={{ width: `${Math.max(2, (l.total / max) * 100)}%` }} /></div>
              <span className="w-14 text-right text-sm font-semibold tabular-nums text-slate-800">{nf(l.total)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
