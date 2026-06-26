import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/permissions";
import { buildRelatorio, parsePeriodo, PERIODO_LABEL } from "@/lib/relatorio";
import PageHeader from "@/components/PageHeader";
import RelatorioFiltros from "@/components/RelatorioFiltros";
import BrasilTilemap from "@/components/BrasilTilemap";

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
  searchParams: Promise<{ periodo?: string; ldr?: string; campanha?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdmin(role)) redirect("/dashboard");

  const sp = await searchParams;
  const periodo = parsePeriodo(sp.periodo);
  const r = await buildRelatorio({ periodo, ldrId: sp.ldr || null, campanha: sp.campanha || null });

  const W = 100;
  const H = 100;
  const stepX = r.dias.length > 1 ? W / (r.dias.length - 1) : W;
  const linePts = r.dias.map((d, i) => `${(i * stepX).toFixed(2)},${(H - (d.total / r.serieMax) * (H - 8) - 4).toFixed(2)}`);
  const areaPath = `M0,${H} L${linePts.join(" L")} L${W},${H} Z`;

  return (
    <>
      <PageHeader title="Relatórios" />
      <main className="mx-auto max-w-[1400px] space-y-5 p-6">
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

        {/* Semáforo de metas — faixa única */}
        <section className="flex divide-x divide-slate-100 overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm">
          {(["ok", "risco", "atrasado"] as const).map((k) => (
            <div key={k} className="flex flex-1 items-center gap-3 px-4 py-3">
              <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[k].dot}`} />
              <span className="text-xl font-semibold tabular-nums text-slate-900">{r.semaforo[k]}</span>
              <span className="text-xs text-slate-500">{STATUS_META[k].label}</span>
            </div>
          ))}
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

          {/* Produção 14 dias */}
          <div className={CARD}>
            <h2 className={TITLE}>Produção · 14 dias</h2>
            <p className={`mb-3 ${SUB}`}>Total diário (preenchimento + correção)</p>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-24 w-full">
              <path d={areaPath} fill="#6366f1" fillOpacity="0.1" />
              <polyline points={linePts.join(" ")} fill="none" stroke="#6366f1" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="mt-2 flex justify-between text-[10px] text-slate-400">
              <span>{r.dias[0].label}</span>
              <span>pico {r.serieMax}</span>
              <span>{r.dias[r.dias.length - 1].label} (hoje)</span>
            </div>
          </div>
        </section>

        {/* Meta × Realizado */}
        <section className={CARD}>
          <h2 className={TITLE}>Meta × Realizado</h2>
          <p className={`mb-3 ${SUB}`}>Cada meta no seu prazo · a marca cinza é o ritmo esperado</p>
          {r.metasView.length === 0 ? (
            <p className="py-5 text-center text-xs text-slate-400">Nenhuma meta para o filtro atual.</p>
          ) : (
            <div className="space-y-3">
              {r.metasView.map((m) => {
                const sm = STATUS_META[m.status];
                const esperadoPct = m.alvo > 0 ? Math.min(100, (m.esperado / m.alvo) * 100) : 0;
                return (
                  <div key={m.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate text-slate-600">
                        <span className="font-medium text-slate-700">{m.nome}</span>
                        <span className="text-slate-400"> · {m.rotulo}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tabular-nums text-slate-400">{m.feito}/{m.alvo} · {m.p}%</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${sm.chip}`}>{sm.label}</span>
                      </span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${sm.bar}`} style={{ width: `${Math.max(2, m.p)}%` }} />
                      <span className="absolute top-0 h-full w-px bg-slate-400" style={{ left: `${esperadoPct}%` }} title={`Esperado: ${m.esperado}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                    <span className="font-semibold tabular-nums text-slate-700">{f.value.toLocaleString("pt-BR")}</span>
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
            <div className="space-y-2.5">
              {([
                { label: "Até 7 dias", value: r.backlog.novos, cor: "bg-emerald-500" },
                { label: "8 a 30 dias", value: r.backlog.medios, cor: "bg-amber-500" },
                { label: "Mais de 30 dias", value: r.backlog.antigos, cor: "bg-rose-500" },
              ] as const).map((b) => (
                <div key={b.label}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-slate-600">{b.label}</span>
                    <span className="font-semibold tabular-nums text-slate-700">{b.value.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${b.cor}`} style={{ width: `${Math.max(2, (b.value / Math.max(1, r.backlog.total)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Completude por base */}
        <section className={CARD}>
          <h2 className={TITLE}>Completude por base</h2>
          <p className={`mb-3 ${SUB}`}>% de prefeituras com a régua completa</p>
          {r.completudePorBase.length === 0 ? (
            <p className="py-5 text-center text-xs text-slate-400">Nenhuma base com contatos.</p>
          ) : (
            <div className="space-y-2.5">
              {r.completudePorBase.map((b) => (
                <div key={b.id}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="min-w-0 truncate text-slate-600">{b.nome}</span>
                    <span className="shrink-0 tabular-nums text-slate-400">{b.completos.toLocaleString("pt-BR")}/{b.total.toLocaleString("pt-BR")} · {b.p}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${b.p >= 80 ? "bg-emerald-500" : b.p >= 40 ? "bg-amber-500" : "bg-indigo-500"}`} style={{ width: `${Math.max(2, b.p)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Mapa + Heatmap */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className={CARD}>
            <h2 className={TITLE}>Mapa por estado</h2>
            <p className={`mb-3 ${SUB}`}>% atualizados (entre sinalizados)</p>
            <BrasilTilemap dados={r.mapaUF} />
          </div>

          <div className={`${CARD} lg:col-span-2`}>
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
