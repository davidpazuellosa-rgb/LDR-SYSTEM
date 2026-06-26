import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/permissions";
import { ufSigla } from "@/lib/uf";
import { tipoOrgao, isComplete } from "@/lib/completude";
import { STATUS_INCORRETO, STATUS_ATUALIZADO } from "@/lib/status";
import { ensureMetaTable } from "@/lib/meta";
import { ensureContactFillTable } from "@/lib/contact-fill";
import {
  metaFeito,
  periodStart,
  startOfDay,
  startOfMonth,
  startOfWeek,
  type Meta,
  type Fill,
  type CorrDone,
} from "@/lib/meta-progress";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

type Periodo = "semana" | "mes" | "tudo";

const PERIODO_LABEL: Record<Periodo, string> = {
  semana: "esta semana",
  mes: "este mês",
  tudo: "desde o início",
};

function inicioDoPeriodo(periodo: Periodo, now: Date): Date {
  if (periodo === "mes") return startOfMonth(now);
  if (periodo === "tudo") return new Date(0);
  return startOfWeek(now);
}

function pct(feito: number, alvo: number) {
  if (alvo <= 0) return feito > 0 ? 100 : 0;
  return Math.min(100, Math.round((feito / alvo) * 100));
}

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

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdmin(role)) redirect("/dashboard");

  const sp = await searchParams;
  const periodo: Periodo = sp.periodo === "mes" ? "mes" : sp.periodo === "tudo" ? "tudo" : "semana";

  const now = new Date();
  const start = inicioDoPeriodo(periodo, now);

  await ensureMetaTable();
  await ensureContactFillTable();

  // Produção (preenchimento + correção) por LDR no período escolhido, séries do tempo
  // e dados das metas (que usam o próprio prazo de cada meta).
  const s14 = startOfDay(now);
  s14.setDate(s14.getDate() - 13);

  const [ldrs, metas, contacts, fillRows, corrRows, pendRows] = await Promise.all([
    prisma.user.findMany({ where: { role: "ldr" }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.meta.findMany() as Promise<Meta[]>,
    prisma.contact.findMany({
      where: { deletedAt: null },
      select: {
        id: true, baseId: true, regiao: true, estado: true, status: true,
        cidade: true, telefonePrefeitura: true, emailInstitucional: true,
        nomePrefeito: true, whatsapp: true, siteOficial: true,
      },
    }),
    prisma.contactFill.findMany({ select: { contactId: true, preenchidoPorId: true, concluidoEm: true } }),
    prisma.correction.findMany({
      where: { status: "resolved", resolvedAt: { not: null } },
      select: { resolvedById: true, resolvedAt: true, contact: { select: { campanha: true } } },
    }),
    prisma.correction.findMany({ where: { status: "pending" }, select: { createdAt: true } }),
  ]);

  const nomeDe = (id: string) => {
    const u = ldrs.find((l) => l.id === id);
    return u?.name || u?.email || "—";
  };

  // Estrutura para o metaFeito (atribuição por território) — igual ao dashboard.
  const terr = new Map(contacts.map((c) => [c.id, c]));
  const fillsTerr: Fill[] = [];
  for (const f of fillRows) {
    const c = terr.get(f.contactId);
    if (c) fillsTerr.push({ concluidoEm: f.concluidoEm, baseId: c.baseId, regiao: c.regiao, estado: c.estado });
  }
  const corrections: CorrDone[] = corrRows.map((r) => ({ resolvedById: r.resolvedById, resolvedAt: r.resolvedAt, campanha: r.contact.campanha }));

  // ---- Ranking por LDR no período (preenchidas + corrigidas) ----
  const ranking = ldrs
    .map((u) => {
      const preenchidas = fillRows.filter((f) => f.preenchidoPorId === u.id && f.concluidoEm >= start).length;
      const corrigidas = corrRows.filter((c) => c.resolvedById === u.id && c.resolvedAt && c.resolvedAt >= start).length;
      return { id: u.id, nome: u.name || u.email, preenchidas, corrigidas, total: preenchidas + corrigidas };
    })
    .sort((a, b) => b.total - a.total);
  const rankMax = Math.max(1, ...ranking.map((r) => r.total));

  // ---- Linha do tempo (14 dias) — produção total da equipe por dia ----
  const dias: { key: string; label: string; total: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = startOfDay(now);
    d.setDate(d.getDate() - i);
    dias.push({ key: d.toISOString().slice(0, 10), label: `${d.getDate()}/${d.getMonth() + 1}`, total: 0 });
  }
  const byDay = new Map(dias.map((d) => [d.key, d]));
  for (const f of fillRows) {
    if (f.concluidoEm < s14) continue;
    const e = byDay.get(new Date(f.concluidoEm).toISOString().slice(0, 10));
    if (e) e.total += 1;
  }
  for (const c of corrRows) {
    if (!c.resolvedAt || c.resolvedAt < s14) continue;
    const e = byDay.get(new Date(c.resolvedAt).toISOString().slice(0, 10));
    if (e) e.total += 1;
  }
  const serieMax = Math.max(1, ...dias.map((d) => d.total));

  // ---- Metas: meta × realizado + semáforo (usam o prazo de cada meta) ----
  const bases = await prisma.base.findMany({ select: { id: true, name: true } });
  const baseName = new Map<string, string>(bases.map((b) => [b.id, b.name]));
  const rotuloMeta = (m: Meta) =>
    m.tipo === "correcao"
      ? `Campanha: ${m.campanha || "—"}`
      : `${tipoOrgao(baseName.get(m.baseId || "") || "")} · ${m.regiao || "—"} · ${ufSigla(m.estado) || m.estado || "—"}`;

  const metasView = metas
    .map((m) => {
      const feito = metaFeito(m, now, fillsTerr, corrections);
      const p = pct(feito, m.alvo);
      // pace: fração do prazo já decorrida (semana/mês) — para sinalizar risco.
      const ini = periodStart(m.prazo, now);
      const fim = m.prazo === "mensal" ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : new Date(ini.getTime() + 7 * 86400000);
      const decorrido = Math.min(1, Math.max(0, (now.getTime() - ini.getTime()) / (fim.getTime() - ini.getTime())));
      const esperado = Math.round(m.alvo * decorrido);
      const status: "ok" | "risco" | "atrasado" = p >= 100 ? "ok" : feito >= esperado ? "ok" : feito >= esperado * 0.6 ? "risco" : "atrasado";
      return { id: m.id, userId: m.userId, nome: nomeDe(m.userId), tipo: m.tipo, rotulo: rotuloMeta(m), feito, alvo: m.alvo, p, esperado, status };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome) || a.status.localeCompare(b.status));

  const semaforo = {
    ok: metasView.filter((m) => m.status === "ok").length,
    risco: metasView.filter((m) => m.status === "risco").length,
    atrasado: metasView.filter((m) => m.status === "atrasado").length,
  };

  // ---- KPIs de FLUXO com variação vs período anterior (mesma duração decorrida) ----
  const elapsed = now.getTime() - start.getTime();
  const prevStart =
    periodo === "semana"
      ? new Date(start.getTime() - 7 * 86400000)
      : periodo === "mes"
        ? startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
        : null;
  const prevEnd = prevStart ? new Date(prevStart.getTime() + elapsed) : null;

  const naJanela = (d: Date | null, a: Date, b: Date) => !!d && d >= a && d < b;
  const corrCur = corrRows.filter((c) => naJanela(c.resolvedAt, start, new Date(now.getTime() + 1))).length;
  const fillCur = fillRows.filter((f) => naJanela(f.concluidoEm, start, new Date(now.getTime() + 1))).length;
  const corrPrev = prevStart && prevEnd ? corrRows.filter((c) => naJanela(c.resolvedAt, prevStart, prevEnd)).length : null;
  const fillPrev = prevStart && prevEnd ? fillRows.filter((f) => naJanela(f.concluidoEm, prevStart, prevEnd)).length : null;
  const [novosCur, novosPrev] = await Promise.all([
    prisma.contact.count({ where: { deletedAt: null, createdAt: { gte: start, lte: now } } }),
    prevStart && prevEnd
      ? prisma.contact.count({ where: { deletedAt: null, createdAt: { gte: prevStart, lt: prevEnd } } })
      : Promise.resolve(null),
  ]);

  const kpis = [
    { label: "Telefones corrigidos", value: corrCur, prev: corrPrev },
    { label: "Prefeituras preenchidas", value: fillCur, prev: fillPrev },
    { label: "Contatos novos", value: novosCur, prev: novosPrev },
  ];

  // ---- Funil de saneamento ----
  const temTelefone = contacts.filter((c) => (c.telefonePrefeitura || "").trim()).length;
  const nIncorreto = contacts.filter((c) => c.status === STATUS_INCORRETO).length;
  const nAtualizado = contacts.filter((c) => c.status === STATUS_ATUALIZADO).length;
  const funil = [
    { label: "Total de contatos", value: contacts.length, cor: "bg-slate-400" },
    { label: "Com telefone", value: temTelefone, cor: "bg-sky-500" },
    { label: "Sinalizados pelo CRM", value: nIncorreto + nAtualizado, cor: "bg-amber-500" },
    { label: "Já atualizados", value: nAtualizado, cor: "bg-emerald-500" },
  ];
  const funilMax = Math.max(1, contacts.length);

  // ---- Completude por base (% de linhas com a régua completa) ----
  const completudePorBase = bases
    .map((b) => {
      const doBase = contacts.filter((c) => c.baseId === b.id);
      const completos = doBase.filter((c) => isComplete(c as Parameters<typeof isComplete>[0])).length;
      return { id: b.id, nome: b.name, total: doBase.length, completos, p: doBase.length ? Math.round((completos / doBase.length) * 100) : 0 };
    })
    .filter((b) => b.total > 0)
    .sort((a, b) => b.total - a.total);

  // ---- Backlog da fila de correção (por idade) ----
  const ageDays = (d: Date) => (now.getTime() - new Date(d).getTime()) / 86400000;
  const backlog = {
    total: pendRows.length,
    novos: pendRows.filter((p) => ageDays(p.createdAt) <= 7).length,
    medios: pendRows.filter((p) => ageDays(p.createdAt) > 7 && ageDays(p.createdAt) <= 30).length,
    antigos: pendRows.filter((p) => ageDays(p.createdAt) > 30).length,
  };

  // Pontos do gráfico de linha (área) em viewBox 100x100.
  const W = 100;
  const H = 100;
  const stepX = dias.length > 1 ? W / (dias.length - 1) : W;
  const linePts = dias.map((d, i) => `${(i * stepX).toFixed(2)},${(H - (d.total / serieMax) * (H - 8) - 4).toFixed(2)}`);
  const areaPath = `M0,${H} L${linePts.join(" L")} L${W},${H} Z`;

  const PeriodoTab = ({ value, label }: { value: Periodo; label: string }) => (
    <Link
      href={`/relatorios?periodo=${value}`}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        periodo === value ? "bg-indigo-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );

  const STATUS_META = {
    ok: { label: "No ritmo", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
    risco: { label: "Em risco", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700" },
    atrasado: { label: "Atrasado", dot: "bg-red-500", chip: "bg-red-50 text-red-700" },
  } as const;

  return (
    <>
      <PageHeader title="Relatórios" />
      <main className="space-y-8 p-8">
        {/* Filtro de período */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Período:</span>
          <PeriodoTab value="semana" label="Esta semana" />
          <PeriodoTab value="mes" label="Este mês" />
          <PeriodoTab value="tudo" label="Tudo" />
          <span className="ml-2 text-xs text-slate-400">Produtividade considera {PERIODO_LABEL[periodo]}; metas usam o prazo de cada meta.</span>
        </div>

        {/* KPIs de fluxo com variação vs período anterior */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {kpis.map((k) => (
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
              <div className="mt-1 text-3xl font-bold text-slate-800">{semaforo[k]}</div>
              <div className="text-xs text-slate-400">meta(s)</div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Ranking de LDRs */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 font-semibold text-slate-800">Ranking de produção por LDR</h2>
            <p className="mb-4 text-xs text-slate-400">Preenchidas + corrigidas · {PERIODO_LABEL[periodo]}</p>
            {ranking.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Nenhum LDR cadastrado.</p>
            ) : (
              <div className="space-y-3">
                {ranking.map((r, i) => (
                  <div key={r.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-700">
                        <span className="mr-1.5 text-slate-400">{i + 1}.</span>
                        {r.nome}
                      </span>
                      <span className="shrink-0 text-slate-500">
                        <span className="font-semibold text-slate-700">{r.total}</span>{" "}
                        <span className="text-xs text-slate-400">({r.preenchidas} pre · {r.corrigidas} cor)</span>
                      </span>
                    </div>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full bg-indigo-500" style={{ width: `${(r.preenchidas / rankMax) * 100}%` }} />
                      <div className="h-full bg-emerald-500" style={{ width: `${(r.corrigidas / rankMax) * 100}%` }} />
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
            <h2 className="mb-1 font-semibold text-slate-800">Produção da equipe · últimos 14 dias</h2>
            <p className="mb-4 text-xs text-slate-400">Total diário (preenchimento + correção)</p>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-40 w-full">
              <path d={areaPath} fill="#6366f1" fillOpacity="0.12" />
              <polyline points={linePts.join(" ")} fill="none" stroke="#6366f1" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>{dias[0].label}</span>
              <span>pico: {serieMax}</span>
              <span>{dias[dias.length - 1].label} (hoje)</span>
            </div>
          </div>
        </section>

        {/* Meta × Realizado (bullet) + semáforo por linha */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-800">Meta × Realizado</h2>
          <p className="mb-4 text-xs text-slate-400">Cada meta no seu prazo · a marca cinza é o ritmo esperado até agora</p>
          {metasView.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Nenhuma meta definida. Configure em Usuários → Meta.</p>
          ) : (
            <div className="space-y-4">
              {metasView.map((m) => {
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
                      <div className={`h-full rounded-full ${m.status === "ok" ? "bg-emerald-500" : m.status === "risco" ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.max(2, m.p)}%` }} />
                      {/* marca do ritmo esperado */}
                      <span className="absolute top-0 h-full w-0.5 bg-slate-500/70" style={{ left: `${esperadoPct}%` }} title={`Esperado até agora: ${m.esperado}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Funil de saneamento + Backlog */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 font-semibold text-slate-800">Funil de saneamento</h2>
            <p className="mb-4 text-xs text-slate-400">Onde os contatos estão no fluxo (toda a base)</p>
            <div className="space-y-3">
              {funil.map((f) => (
                <div key={f.label}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-slate-600">{f.label}</span>
                    <span className="font-semibold text-slate-700">{f.value.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${f.cor}`} style={{ width: `${Math.max(2, (f.value / funilMax) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 font-semibold text-slate-800">Backlog da fila de correção</h2>
            <p className="mb-4 text-xs text-slate-400">Pendências por idade</p>
            <div className="mb-4">
              <span className="text-3xl font-bold text-slate-800">{backlog.total.toLocaleString("pt-BR")}</span>
              <span className="ml-2 text-sm text-slate-400">pendentes no total</span>
            </div>
            <div className="space-y-3">
              {([
                { label: "Até 7 dias", value: backlog.novos, cor: "bg-emerald-500" },
                { label: "8 a 30 dias", value: backlog.medios, cor: "bg-amber-500" },
                { label: "Mais de 30 dias", value: backlog.antigos, cor: "bg-red-500" },
              ] as const).map((b) => (
                <div key={b.label}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-slate-600">{b.label}</span>
                    <span className="font-semibold text-slate-700">{b.value.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${b.cor}`} style={{ width: `${Math.max(2, (b.value / Math.max(1, backlog.total)) * 100)}%` }} />
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
          {completudePorBase.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Nenhuma base com contatos.</p>
          ) : (
            <div className="space-y-3">
              {completudePorBase.map((b) => (
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
      </main>
    </>
  );
}
