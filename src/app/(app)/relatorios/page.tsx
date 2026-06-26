import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/permissions";
import { buildRelatorio, parsePeriodo, PERIODO_LABEL } from "@/lib/relatorio";
import PageHeader from "@/components/PageHeader";
import RelatorioFiltros from "@/components/RelatorioFiltros";
import BrasilTilemap from "@/components/BrasilTilemap";

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export const dynamic = "force-dynamic";

function Delta({ cur, prev }: { cur: number; prev: number | null }) {
  if (prev === null) return <span className="text-xs text-slate-400">sem comparativo</span>;
  if (prev === 0) return <span className="text-xs text-slate-400">{cur > 0 ? "novo no período" : "—"}</span>;
  const d = Math.round(((cur - prev) / prev) * 100);
  const up = d >= 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-emerald-600" : "text-red-600"}`}>
      {up ? "▲" : "▼"} {Math.abs(d)}% <span className="font-normal text-slate-400">vs. período anterior</span>
    </span>
  );
}

const STATUS_META = {
  ok: { label: "No ritmo", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" },
  risco: { label: "Em risco", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500" },
  atrasado: { label: "Atrasado", dot: "bg-red-500", chip: "bg-red-50 text-red-700", bar: "bg-red-500" },
} as const;

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; ldr?: string; campanha?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdmin(role)) redirect("/dashboard");

  const sp = await searchParams;
  const periodo = parsePeriodo(sp.periodo);
  const r = await buildRelatorio({ periodo, ldrId: sp.ldr || null, campanha: sp.campanha || null });

  // Pontos do gráfico de linha (área) em viewBox 100x100.
  const W = 100;
  const H = 100;
  const stepX = r.dias.length > 1 ? W / (r.dias.length - 1) : W;
  const linePts = r.dias.map((d, i) => `${(i * stepX).toFixed(2)},${(H - (d.total / r.serieMax) * (H - 8) - 4).toFixed(2)}`);
  const areaPath = `M0,${H} L${linePts.join(" L")} L${W},${H} Z`;

  return (
    <>
      <PageHeader title="Relatórios" />
      <main className="space-y-8 p-8">
        <RelatorioFiltros
          periodo={periodo}
          ldrId={r.ldrId}
          campanha={r.campanha}
          ldrs={r.ldrs.map((l) => ({ id: l.id, nome: l.name || l.email }))}
          campanhas={r.campanhas}
        />

        {/* KPIs de fluxo com variação */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {r.kpis.map((k) => (
            <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-3xl font-bold text-slate-800">{k.value.toLocaleString("pt-BR")}</div>
              <div className="mt-1 text-sm text-slate-600">{k.label}</div>
              <div className="mt-1"><Delta cur={k.value} prev={k.prev} /></div>
            </div>
          ))}
        </section>

        {/* Semáforo de metas (resumo) */}
        <section className="grid grid-cols-3 gap-4">
          {(["ok", "risco", "atrasado"] as const).map((k) => (
            <div key={k} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[k].dot}`} />
                <span className="text-sm text-slate-600">{STATUS_META[k].label}</span>
              </div>
              <div className="mt-1 text-3xl font-bold text-slate-800">{r.semaforo[k]}</div>
              <div className="text-xs text-slate-400">meta(s)</div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Ranking de LDRs */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 font-semibold text-slate-800">Ranking de produção por LDR</h2>
            <p className="mb-4 text-xs text-slate-400">Preenchidas + corrigidas · {PERIODO_LABEL[periodo]}</p>
            {r.ranking.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Nenhum LDR para o filtro atual.</p>
            ) : (
              <div className="space-y-3">
                {r.ranking.map((row, i) => (
                  <div key={row.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-700">
                        <span className="mr-1.5 text-slate-400">{i + 1}.</span>
                        {row.nome}
                      </span>
                      <span className="shrink-0 text-slate-500">
                        <span className="font-semibold text-slate-700">{row.total}</span>{" "}
                        <span className="text-xs text-slate-400">({row.preenchidas} pre · {row.corrigidas} cor)</span>
                      </span>
                    </div>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full bg-indigo-500" style={{ width: `${(row.preenchidas / r.rankMax) * 100}%` }} />
                      <div className="h-full bg-emerald-500" style={{ width: `${(row.corrigidas / r.rankMax) * 100}%` }} />
                    </div>
                  </div>
                ))}
                <div className="flex gap-4 pt-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Preenchimento</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Correção</span>
                </div>
              </div>
            )}
          </div>

          {/* Produção da equipe — 14 dias */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 font-semibold text-slate-800">Produção · últimos 14 dias</h2>
            <p className="mb-4 text-xs text-slate-400">Total diário (preenchimento + correção)</p>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-40 w-full">
              <path d={areaPath} fill="#6366f1" fillOpacity="0.12" />
              <polyline points={linePts.join(" ")} fill="none" stroke="#6366f1" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>{r.dias[0].label}</span>
              <span>pico: {r.serieMax}</span>
              <span>{r.dias[r.dias.length - 1].label} (hoje)</span>
            </div>
          </div>
        </section>

        {/* Meta × Realizado (bullet) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-800">Meta × Realizado</h2>
          <p className="mb-4 text-xs text-slate-400">Cada meta no seu prazo · a marca cinza é o ritmo esperado até agora</p>
          {r.metasView.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Nenhuma meta para o filtro atual.</p>
          ) : (
            <div className="space-y-4">
              {r.metasView.map((m) => {
                const sm = STATUS_META[m.status];
                const esperadoPct = m.alvo > 0 ? Math.min(100, (m.esperado / m.alvo) * 100) : 0;
                return (
                  <div key={m.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-slate-700">
                        <span className="font-medium">{m.nome}</span>
                        <span className="text-slate-400"> · {m.rotulo}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-slate-500">{m.feito} / {m.alvo} ({m.p}%)</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sm.chip}`}>{sm.label}</span>
                      </span>
                    </div>
                    <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${sm.bar}`} style={{ width: `${Math.max(2, m.p)}%` }} />
                      <span className="absolute top-0 h-full w-0.5 bg-slate-500/70" style={{ left: `${esperadoPct}%` }} title={`Esperado até agora: ${m.esperado}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Funil + Backlog */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 font-semibold text-slate-800">Funil de saneamento</h2>
            <p className="mb-4 text-xs text-slate-400">Onde os contatos estão no fluxo{r.campanha ? ` · ${r.campanha}` : " (toda a base)"}</p>
            <div className="space-y-3">
              {r.funil.map((f) => (
                <div key={f.label}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-slate-600">{f.label}</span>
                    <span className="font-semibold text-slate-700">{f.value.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${f.cor}`} style={{ width: `${Math.max(2, (f.value / r.funilMax) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 font-semibold text-slate-800">Backlog da fila de correção</h2>
            <p className="mb-4 text-xs text-slate-400">Pendências por idade</p>
            <div className="mb-4">
              <span className="text-3xl font-bold text-slate-800">{r.backlog.total.toLocaleString("pt-BR")}</span>
              <span className="ml-2 text-sm text-slate-400">pendentes no total</span>
            </div>
            <div className="space-y-3">
              {([
                { label: "Até 7 dias", value: r.backlog.novos, cor: "bg-emerald-500" },
                { label: "8 a 30 dias", value: r.backlog.medios, cor: "bg-amber-500" },
                { label: "Mais de 30 dias", value: r.backlog.antigos, cor: "bg-red-500" },
              ] as const).map((b) => (
                <div key={b.label}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-slate-600">{b.label}</span>
                    <span className="font-semibold text-slate-700">{b.value.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${b.cor}`} style={{ width: `${Math.max(2, (b.value / Math.max(1, r.backlog.total)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Completude por base */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-800">Completude por base</h2>
          <p className="mb-4 text-xs text-slate-400">% de prefeituras com todos os campos da régua preenchidos</p>
          {r.completudePorBase.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Nenhuma base com contatos.</p>
          ) : (
            <div className="space-y-3">
              {r.completudePorBase.map((b) => (
                <div key={b.id}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="min-w-0 truncate text-slate-700">{b.nome}</span>
                    <span className="shrink-0 text-slate-500">{b.completos.toLocaleString("pt-BR")} / {b.total.toLocaleString("pt-BR")} ({b.p}%)</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${b.p >= 80 ? "bg-emerald-500" : b.p >= 40 ? "bg-amber-500" : "bg-indigo-500"}`} style={{ width: `${Math.max(2, b.p)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Mapa do Brasil + Heatmap de atividade */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 font-semibold text-slate-800">Mapa por estado</h2>
            <p className="mb-4 text-xs text-slate-400">% de telefones atualizados (entre os sinalizados)</p>
            <BrasilTilemap dados={r.mapaUF} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="mb-1 font-semibold text-slate-800">Atividade por dia e hora</h2>
            <p className="mb-4 text-xs text-slate-400">Produção da equipe (horário de Brasília){r.ldrId ? " · LDR filtrado" : ""}</p>
            <div className="space-y-1">
              {/* Régua de horas */}
              <div className="flex items-center gap-1 pl-8 text-[9px] text-slate-400">
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="flex-1 text-center">{h % 6 === 0 ? `${h}h` : ""}</span>
                ))}
              </div>
              {r.heat.map((linha, wd) => (
                <div key={wd} className="flex items-center gap-1">
                  <span className="w-7 shrink-0 text-[10px] font-medium text-slate-500">{DIAS_SEMANA[wd]}</span>
                  {linha.map((count, h) => (
                    <span
                      key={h}
                      title={`${DIAS_SEMANA[wd]} ${h}h — ${count} ação(ões)`}
                      className="aspect-square flex-1 rounded-[3px]"
                      style={{ backgroundColor: count ? `rgba(99,102,241,${(0.15 + 0.85 * (count / r.heatMax)).toFixed(3)})` : "#f1f5f9" }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-400">
              <span>menos</span>
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: "rgba(99,102,241,0.2)" }} />
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: "rgba(99,102,241,0.5)" }} />
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: "rgba(99,102,241,1)" }} />
              <span>mais (pico {r.heatMax})</span>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
