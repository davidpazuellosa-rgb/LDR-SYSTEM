import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/permissions";
import { buildRelatorio, parsePeriodo, PERIODO_LABEL } from "@/lib/relatorio";
import PageHeader from "@/components/PageHeader";
import RelatorioFiltros from "@/components/RelatorioFiltros";
import RelatoriosTabs from "@/components/RelatoriosTabs";
import Link from "next/link";
import DataTable from "@/components/DataTable";
import { regiaoDaUf } from "@/lib/uf";

export const dynamic = "force-dynamic";

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const CARD = "rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm";
const TITLE = "text-[13px] font-semibold text-slate-700";
const SUB = "text-[11px] text-slate-400";

function Delta({ cur, prev }: { cur: number; prev: number | null }) {
  if (prev === null) return <span className="text-[11px] text-slate-400">sem comparativo</span>;
  if (prev === 0) return <span className="text-[11px] text-slate-400">{cur > 0 ? "novo no período" : "—"}</span>;
  const d = Math.round(((cur - prev) / prev) * 100);
  const up = d >= 0;
  return (
    <span className={`text-[11px] font-medium ${up ? "text-emerald-600" : "text-rose-500"}`}>
      {up ? "↑" : "↓"} {Math.abs(d)}% <span className="font-normal text-slate-400">vs. anterior</span>
    </span>
  );
}

const STATUS_META = {
  ok: { label: "No ritmo", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" },
  risco: { label: "Em risco", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500" },
  atrasado: { label: "Atrasado", dot: "bg-rose-500", chip: "bg-rose-50 text-rose-600", bar: "bg-rose-500" },
} as const;

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; ldr?: string; campanha?: string; situacao?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdmin(role)) redirect("/dashboard");

  const sp = await searchParams;
  const periodo = parsePeriodo(sp.periodo);
  const situacao = (["ok", "risco", "atrasado"] as const).find((x) => x === sp.situacao) ?? null;
  const r = await buildRelatorio({ periodo, ldrId: sp.ldr || null, campanha: sp.campanha || null });

  return (
    <>
      <PageHeader title="Relatórios" />
      <main className="mx-auto max-w-[1400px] space-y-5 p-6">
        <RelatoriosTabs ativa="geral" />
        <RelatorioFiltros
          periodo={periodo}
          ldrId={r.ldrId}
          campanha={r.campanha}
          ldrs={r.ldrs.map((l) => ({ id: l.id, nome: l.name || l.email }))}
          campanhas={r.campanhas}
        />

        {/* KPIs de fluxo */}
        <section className="grid grid-cols-3 gap-3">
          {r.kpis.map((k) => (
            <div key={k.label} className={CARD}>
              <div className="text-2xl font-semibold tabular-nums text-slate-900">{k.value.toLocaleString("pt-BR")}</div>
              <div className="mt-0.5 text-xs text-slate-500">{k.label}</div>
              <div className="mt-1"><Delta cur={k.value} prev={k.prev} /></div>
            </div>
          ))}
        </section>

        {/* Semáforo de metas — clicável: filtra a tabela Meta × Realizado pela situação */}
        <section className="flex divide-x divide-slate-100 overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm">
          {(["ok", "risco", "atrasado"] as const).map((k) => {
            const qs = new URLSearchParams();
            if (sp.periodo) qs.set("periodo", sp.periodo);
            if (sp.ldr) qs.set("ldr", sp.ldr);
            if (sp.campanha) qs.set("campanha", sp.campanha);
            if (situacao !== k) qs.set("situacao", k); // clicar na ativa limpa o filtro
            const q = qs.toString();
            return (
              <Link
                key={k}
                href={`/relatorios${q ? `?${q}` : ""}#metas`}
                scroll
                className={`flex flex-1 items-center gap-3 px-4 py-3 transition hover:bg-slate-50 ${situacao === k ? "bg-indigo-50/70 ring-2 ring-inset ring-indigo-300" : ""}`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[k].dot}`} />
                <span className="text-xl font-semibold tabular-nums text-slate-900">{r.semaforo[k]}</span>
                <span className="text-xs text-slate-500">{STATUS_META[k].label}</span>
              </Link>
            );
          })}
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Ranking */}
          <div className={CARD}>
            <h2 className={TITLE}>Ranking por LDR</h2>
            <p className={`mb-3 ${SUB}`}>Preenchidas + corrigidas · {PERIODO_LABEL[periodo]}</p>
            {r.ranking.length === 0 ? (
              <p className="py-5 text-center text-xs text-slate-400">Nenhum LDR para o filtro atual.</p>
            ) : (
              <div className="space-y-2.5">
                {r.ranking.map((row, i) => (
                  <div key={row.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate text-slate-600">
                        <span className="mr-1 text-slate-400">{i + 1}.</span>
                        {row.nome}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-400">
                        <span className="font-semibold text-slate-700">{row.total}</span> ({row.preenchidas}p · {row.corrigidas}c)
                      </span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full bg-indigo-500" style={{ width: `${(row.preenchidas / r.rankMax) * 100}%` }} />
                      <div className="h-full bg-emerald-500" style={{ width: `${(row.corrigidas / r.rankMax) * 100}%` }} />
                    </div>
                  </div>
                ))}
                <div className="flex gap-3 pt-0.5 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> Preenchimento</span>
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Correção</span>
                </div>
              </div>
            )}
          </div>

          {/* Produção 14 dias — barras com valor e tooltip (antes: linha sem eixos) */}
          <div className={CARD}>
            <h2 className={TITLE}>Produção · 14 dias</h2>
            <p className={`mb-3 ${SUB}`}>Total diário (preenchimento + correção) · pico {r.serieMax}</p>
            <div className="flex h-36 items-end gap-1">
              {r.dias.map((d, i) => (
                <div key={d.key} className="group relative flex h-full flex-1 flex-col items-center justify-end" title={`${d.label}: ${d.total}`}>
                  <span className="mb-0.5 text-[10px] tabular-nums text-slate-400">{d.total || ""}</span>
                  <div className={`w-full rounded-t ${i === r.dias.length - 1 ? "bg-indigo-600" : "bg-indigo-400"}`} style={{ height: `${Math.max(d.total ? 4 : 1, (d.total / r.serieMax) * 100)}%`, opacity: d.total ? 1 : 0.25 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-1 text-[10px] text-slate-400">
              {r.dias.map((d, i) => <span key={d.key} className="flex-1 text-center">{i % 2 === 0 || i === r.dias.length - 1 ? d.label : ""}</span>)}
            </div>
          </div>
        </section>

        {/* Meta × Realizado — tabela (antes: uma barra por meta) */}
        <section id="metas" className={CARD}>
          <h2 className={TITLE}>Meta × Realizado{situacao ? <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">só {STATUS_META[situacao].label}</span> : null}</h2>
          <p className={`mb-3 ${SUB}`}>Cada meta no seu prazo · ordene e busque por pessoa, território ou situação</p>
          <DataTable
            csvName="meta-x-realizado"
            searchKeys={["nome", "rotulo", "status"]}
            searchPlaceholder="Buscar pessoa ou território"
            maxHeight={380}
            empty="Nenhuma meta para o filtro atual."
            cols={[
              { key: "nome", label: "Pessoa", kind: "text" },
              { key: "rotulo", label: "Meta", kind: "text" },
              { key: "feito", label: "Feito", kind: "num" },
              { key: "alvo", label: "Alvo", kind: "num" },
              { key: "p", label: "%", kind: "pct", ok: 100, meio: 60 },
              { key: "status", label: "Situação", kind: "status" },
            ]}
            rows={r.metasView.filter((m) => !situacao || m.status === situacao).map((m) => ({ nome: m.nome, rotulo: m.rotulo, feito: m.feito, alvo: m.alvo, p: m.p, status: m.status }))}
          />
        </section>

        {/* Funil + Backlog */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={CARD}>
            <h2 className={TITLE}>Funil de saneamento</h2>
            <p className={`mb-3 ${SUB}`}>{r.campanha ? `Campanha ${r.campanha}` : "Toda a base"}</p>
            <div className="space-y-2.5">
              {r.funil.map((f) => (
                <div key={f.label}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-slate-600">{f.label}</span>
                    <span className="font-semibold tabular-nums text-slate-700">
                      {f.value.toLocaleString("pt-BR")}
                      {r.funilMax > 0 && <span className="ml-1.5 font-normal text-slate-400">{Math.round((f.value / r.funilMax) * 100)}%</span>}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${f.cor}`} style={{ width: `${Math.max(2, (f.value / r.funilMax) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={CARD}>
            <div className="flex items-baseline justify-between">
              <h2 className={TITLE}>Backlog da fila</h2>
              <span className="text-lg font-semibold tabular-nums text-slate-900">{r.backlog.total.toLocaleString("pt-BR")}</span>
            </div>
            <p className={`mb-3 ${SUB}`}>Pendências por idade</p>
            {r.backlog.total === 0 ? (
              <p className="py-3 text-center text-xs text-slate-400">Fila vazia.</p>
            ) : (
              <>
                <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="bg-emerald-500" style={{ width: `${(r.backlog.novos / r.backlog.total) * 100}%` }} title={`Até 7 dias: ${r.backlog.novos}`} />
                  <div className="bg-amber-500" style={{ width: `${(r.backlog.medios / r.backlog.total) * 100}%` }} title={`8 a 30 dias: ${r.backlog.medios}`} />
                  <div className="bg-rose-500" style={{ width: `${(r.backlog.antigos / r.backlog.total) * 100}%` }} title={`Mais de 30 dias: ${r.backlog.antigos}`} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  {([
                    { label: "Até 7 dias", value: r.backlog.novos, dot: "bg-emerald-500" },
                    { label: "8 a 30 dias", value: r.backlog.medios, dot: "bg-amber-500" },
                    { label: "Mais de 30 dias", value: r.backlog.antigos, dot: "bg-rose-500" },
                  ] as const).map((b) => (
                    <div key={b.label}>
                      <div className="flex items-center gap-1.5 text-slate-500"><span className={`h-2 w-2 rounded-full ${b.dot}`} />{b.label}</div>
                      <div className="mt-0.5 text-base font-semibold tabular-nums text-slate-800">{b.value.toLocaleString("pt-BR")}</div>
                      <div className="text-[10px] text-slate-400">{Math.round((b.value / r.backlog.total) * 100)}%</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Completude por base */}
        <section className={CARD}>
          <h2 className={TITLE}>Completude por base</h2>
          <p className={`mb-3 ${SUB}`}>% de prefeituras com a régua completa</p>
          <DataTable
            csvName="completude-por-base"
            searchKeys={["nome"]}
            searchPlaceholder="Buscar base"
            maxHeight={380}
            empty="Nenhuma base com contatos."
            defaultSort={{ key: "total", dir: -1 }}
            cols={[
              { key: "nome", label: "Base", kind: "text" },
              { key: "total", label: "Prefeituras", kind: "num" },
              { key: "completos", label: "Completas", kind: "num" },
              { key: "p", label: "% completas", kind: "pct", ok: 80, meio: 40 },
            ]}
            rows={r.completudePorBase.map((b) => ({ nome: b.nome, total: b.total, completos: b.completos, p: b.p }))}
          />
        </section>

        {/* Estados (tabela) + Heatmap */}
        <section className={CARD}>
          <h2 className={TITLE}>Estados</h2>
          <p className={`mb-3 ${SUB}`}>% atualizados entre os contatos sinalizados pelo CRM · “—” = nenhum sinalizado</p>
          <DataTable
            csvName="estados"
            searchKeys={["uf", "regiao"]}
            searchPlaceholder="Buscar UF ou região"
            maxHeight={460}
            defaultSort={{ key: "total", dir: -1 }}
            cols={[
              { key: "uf", label: "UF", kind: "text" },
              { key: "regiao", label: "Região", kind: "text" },
              { key: "total", label: "Contatos", kind: "num" },
              { key: "incorreto", label: "Incorretos", kind: "num" },
              { key: "atualizado", label: "Atualizados", kind: "num" },
              { key: "taxa", label: "% atualizados", kind: "pct", ok: 80, meio: 50 },
            ]}
            rows={Object.entries(r.mapaUF).map(([uf, d]) => ({ uf, regiao: regiaoDaUf(uf) || "—", total: d.total, incorreto: d.incorreto, atualizado: d.atualizado, taxa: d.taxa }))}
            total={(() => {
              const v = Object.values(r.mapaUF);
              const inc = v.reduce((a, d) => a + d.incorreto, 0);
              const at = v.reduce((a, d) => a + d.atualizado, 0);
              return { uf: "Total", regiao: "", total: v.reduce((a, d) => a + d.total, 0), incorreto: inc, atualizado: at, taxa: inc + at ? Math.round((at / (inc + at)) * 100) : null };
            })()}
          />
        </section>

        <section className="grid grid-cols-1 gap-4">
          <div className={CARD}>
            <h2 className={TITLE}>Atividade por dia e hora</h2>
            <p className={`mb-3 ${SUB}`}>Horário de Brasília{r.ldrId ? " · LDR filtrado" : ""}</p>
            <div className="space-y-1">
              <div className="flex items-center gap-0.5 pl-7 text-[9px] text-slate-400">
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="flex-1 text-center">{h % 6 === 0 ? `${h}h` : ""}</span>
                ))}
              </div>
              {r.heat.map((linha, wd) => (
                <div key={wd} className="flex items-center gap-0.5">
                  <span className="w-7 shrink-0 text-[10px] font-medium text-slate-400">{DIAS_SEMANA[wd]}</span>
                  {linha.map((count, h) => (
                    <span
                      key={h}
                      title={`${DIAS_SEMANA[wd]} ${h}h — ${count}`}
                      className="aspect-square flex-1 rounded-[2px]"
                      style={{ backgroundColor: count ? `rgba(99,102,241,${(0.15 + 0.85 * (count / r.heatMax)).toFixed(3)})` : "#f1f5f9" }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
              <span>menos</span>
              <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: "rgba(99,102,241,0.2)" }} />
              <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: "rgba(99,102,241,0.5)" }} />
              <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: "rgba(99,102,241,1)" }} />
              <span>mais · pico {r.heatMax}</span>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
