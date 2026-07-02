// Agregação dos relatórios do admin — reusada pela página /relatorios e pela
// exportação CSV (/api/relatorios/export), para não duplicar a lógica.
import { prisma } from "@/lib/prisma";
import { isComplete, tipoOrgao } from "@/lib/completude";
import { ufSigla } from "@/lib/uf";
import { OPERATOR_ROLES } from "@/lib/permissions";
import {
  metaFeito,
  periodStart,
  periodEnd,
  startOfDay,
  startOfMonth,
  startOfWeek,
  type Meta,
  type Fill,
  type CorrDone,
} from "@/lib/meta-progress";
import { STATUS_INCORRETO, STATUS_ATUALIZADO } from "@/lib/status";
import { ensureMetaTable } from "@/lib/meta";
import { ensureContactFillTable } from "@/lib/contact-fill";

export type Periodo = "semana" | "mes" | "tudo";
export type RelatorioFiltros = { periodo: Periodo; ldrId?: string | null; campanha?: string | null };

export const PERIODO_LABEL: Record<Periodo, string> = {
  semana: "esta semana",
  mes: "este mês",
  tudo: "desde o início",
};

export function parsePeriodo(v?: string | null): Periodo {
  return v === "mes" ? "mes" : v === "tudo" ? "tudo" : "semana";
}

function inicioDoPeriodo(periodo: Periodo, now: Date): Date {
  if (periodo === "mes") return startOfMonth(now);
  if (periodo === "tudo") return new Date(0);
  return startOfWeek(now);
}

function pct(feito: number, alvo: number) {
  if (alvo <= 0) return feito > 0 ? 100 : 0;
  return Math.min(100, Math.round((feito / alvo) * 100));
}

export type StatusMeta = "ok" | "risco" | "atrasado";

export async function buildRelatorio(f: RelatorioFiltros) {
  const periodo = f.periodo;
  const ldrId = f.ldrId || null;
  const campanha = f.campanha || null;

  const now = new Date();
  const start = inicioDoPeriodo(periodo, now);

  await ensureMetaTable();
  await ensureContactFillTable();

  const s14 = startOfDay(now);
  s14.setDate(s14.getDate() - 13);

  const [ldrs, metasAll, contactsAll, fillRowsAll, corrRowsAll, pendRows, bases] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: OPERATOR_ROLES } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.meta.findMany({
      where: { OR: [{ dataLimite: null }, { dataLimite: { gte: startOfDay(now) } }] },
    }) as Promise<Meta[]>,
    prisma.contact.findMany({
      where: { deletedAt: null },
      select: {
        id: true, baseId: true, regiao: true, estado: true, status: true, campanha: true,
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
    prisma.base.findMany({ select: { id: true, name: true } }),
  ]);

  // Lista de campanhas (para o filtro) — distintas e não vazias.
  const campanhas = Array.from(
    new Set(contactsAll.map((c) => (c.campanha || "").trim()).filter(Boolean))
  ).sort();

  // Aplica filtro de campanha aos contatos (afeta funil/completude e o join dos fills).
  const matchCamp = (cmp: string | null | undefined) => !campanha || (cmp || "").trim() === campanha;
  const contacts = contactsAll.filter((c) => matchCamp(c.campanha));
  const contactById = new Map(contactsAll.map((c) => [c.id, c]));
  const contactIds = new Set(contacts.map((c) => c.id));

  // Fills filtrados por campanha (via contato) e — para ranking/série — sem filtro de LDR ainda.
  const fillRows = fillRowsAll.filter((fr) => !campanha || contactIds.has(fr.contactId));
  const corrRows = corrRowsAll.filter((cr) => matchCamp(cr.contact.campanha));

  const baseName = new Map<string, string>(bases.map((b) => [b.id, b.name]));
  const nomeDe = (id: string) => {
    const u = ldrs.find((l) => l.id === id);
    return u?.name || u?.email || "—";
  };

  // Estrutura para metaFeito (atribuição por território).
  const fillsTerr: Fill[] = [];
  for (const fr of fillRows) {
    const c = contactById.get(fr.contactId);
    if (c) fillsTerr.push({ concluidoEm: fr.concluidoEm, baseId: c.baseId, regiao: c.regiao, estado: c.estado });
  }
  const corrections: CorrDone[] = corrRows.map((r) => ({ resolvedById: r.resolvedById, resolvedAt: r.resolvedAt, campanha: r.contact.campanha }));

  // ---- Ranking por LDR no período ----
  const ldrsView = ldrId ? ldrs.filter((l) => l.id === ldrId) : ldrs;
  const ranking = ldrsView
    .map((u) => {
      const preenchidas = fillRows.filter((fr) => fr.preenchidoPorId === u.id && fr.concluidoEm >= start).length;
      const corrigidas = corrRows.filter((c) => c.resolvedById === u.id && c.resolvedAt && c.resolvedAt >= start).length;
      return { id: u.id, nome: u.name || u.email, preenchidas, corrigidas, total: preenchidas + corrigidas };
    })
    .sort((a, b) => b.total - a.total);
  const rankMax = Math.max(1, ...ranking.map((r) => r.total));

  // ---- Série 14 dias (produção total da seleção) ----
  const dias: { key: string; label: string; total: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = startOfDay(now);
    d.setDate(d.getDate() - i);
    dias.push({ key: d.toISOString().slice(0, 10), label: `${d.getDate()}/${d.getMonth() + 1}`, total: 0 });
  }
  const byDay = new Map(dias.map((d) => [d.key, d]));
  for (const fr of fillRows) {
    if (fr.concluidoEm < s14 || (ldrId && fr.preenchidoPorId !== ldrId)) continue;
    const e = byDay.get(new Date(fr.concluidoEm).toISOString().slice(0, 10));
    if (e) e.total += 1;
  }
  for (const c of corrRows) {
    if (!c.resolvedAt || c.resolvedAt < s14 || (ldrId && c.resolvedById !== ldrId)) continue;
    const e = byDay.get(new Date(c.resolvedAt).toISOString().slice(0, 10));
    if (e) e.total += 1;
  }
  const serieMax = Math.max(1, ...dias.map((d) => d.total));

  // ---- KPIs de fluxo com variação ----
  const elapsed = now.getTime() - start.getTime();
  const prevStart =
    periodo === "semana"
      ? new Date(start.getTime() - 7 * 86400000)
      : periodo === "mes"
        ? startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
        : null;
  const prevEnd = prevStart ? new Date(prevStart.getTime() + elapsed) : null;
  const naJanela = (d: Date | null, a: Date, b: Date) => !!d && d >= a && d < b;
  const fimAtual = new Date(now.getTime() + 1);
  const okLdrCorr = (id: string | null) => !ldrId || id === ldrId;
  const okLdrFill = (id: string) => !ldrId || id === ldrId;

  const corrCur = corrRows.filter((c) => okLdrCorr(c.resolvedById) && naJanela(c.resolvedAt, start, fimAtual)).length;
  const fillCur = fillRows.filter((fr) => okLdrFill(fr.preenchidoPorId) && naJanela(fr.concluidoEm, start, fimAtual)).length;
  const corrPrev = prevStart && prevEnd ? corrRows.filter((c) => okLdrCorr(c.resolvedById) && naJanela(c.resolvedAt, prevStart, prevEnd)).length : null;
  const fillPrev = prevStart && prevEnd ? fillRows.filter((fr) => okLdrFill(fr.preenchidoPorId) && naJanela(fr.concluidoEm, prevStart, prevEnd)).length : null;

  // "Contatos novos" não é atribuível a um LDR — só mostra quando não há filtro de LDR.
  let novosCur: number | null = null;
  let novosPrev: number | null = null;
  if (!ldrId) {
    const whereCamp = campanha ? { campanha } : {};
    [novosCur, novosPrev] = await Promise.all([
      prisma.contact.count({ where: { deletedAt: null, ...whereCamp, createdAt: { gte: start, lte: now } } }),
      prevStart && prevEnd
        ? prisma.contact.count({ where: { deletedAt: null, ...whereCamp, createdAt: { gte: prevStart, lt: prevEnd } } })
        : Promise.resolve(null),
    ]);
  }
  const kpis: { label: string; value: number; prev: number | null }[] = [
    { label: "Telefones corrigidos", value: corrCur, prev: corrPrev },
    { label: "Prefeituras preenchidas", value: fillCur, prev: fillPrev },
    ...(ldrId ? [] : [{ label: "Contatos novos", value: novosCur ?? 0, prev: novosPrev }]),
  ];

  // ---- Metas: meta × realizado + semáforo ----
  const metasFiltradas = metasAll.filter((m) => {
    if (ldrId && m.userId !== ldrId) return false;
    if (campanha && m.tipo === "correcao") return (m.campanha || "").trim() === campanha;
    if (campanha && m.tipo !== "correcao") return false; // preenchimento não tem campanha
    return true;
  });
  const rotuloMeta = (m: Meta) =>
    m.tipo === "correcao"
      ? `Campanha: ${m.campanha || "—"}`
      : `${tipoOrgao(baseName.get(m.baseId || "") || "")} · ${m.regiao || "—"} · ${ufSigla(m.estado) || m.estado || "—"}`;

  const metasView = metasFiltradas
    .map((m) => {
      const feito = metaFeito(m, now, fillsTerr, corrections);
      const p = pct(feito, m.alvo);
      const ini = periodStart(m.prazo, now);
      const fim = periodEnd(m.prazo, now);
      const decorrido = Math.min(1, Math.max(0, (now.getTime() - ini.getTime()) / (fim.getTime() - ini.getTime())));
      const esperado = Math.round(m.alvo * decorrido);
      const status: StatusMeta = p >= 100 ? "ok" : feito >= esperado ? "ok" : feito >= esperado * 0.6 ? "risco" : "atrasado";
      return { id: m.id, userId: m.userId, nome: nomeDe(m.userId), tipo: m.tipo, rotulo: rotuloMeta(m), feito, alvo: m.alvo, p, esperado, status };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome) || a.status.localeCompare(b.status));

  const semaforo = {
    ok: metasView.filter((m) => m.status === "ok").length,
    risco: metasView.filter((m) => m.status === "risco").length,
    atrasado: metasView.filter((m) => m.status === "atrasado").length,
  };

  // ---- Funil de saneamento (respeita campanha) ----
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

  // ---- Completude por base ----
  const completudePorBase = bases
    .map((b) => {
      const doBase = contacts.filter((c) => c.baseId === b.id);
      const completos = doBase.filter((c) => isComplete(c as Parameters<typeof isComplete>[0])).length;
      return { id: b.id, nome: b.name, total: doBase.length, completos, p: doBase.length ? Math.round((completos / doBase.length) * 100) : 0 };
    })
    .filter((b) => b.total > 0)
    .sort((a, b) => b.total - a.total);

  // ---- Backlog da fila ----
  const ageDays = (d: Date) => (now.getTime() - new Date(d).getTime()) / 86400000;
  const backlog = {
    total: pendRows.length,
    novos: pendRows.filter((p) => ageDays(p.createdAt) <= 7).length,
    medios: pendRows.filter((p) => ageDays(p.createdAt) > 7 && ageDays(p.createdAt) <= 30).length,
    antigos: pendRows.filter((p) => ageDays(p.createdAt) > 30).length,
  };

  // ---- Mapa por UF (status dos contatos) ----
  const ufAgg = new Map<string, { total: number; incorreto: number; atualizado: number }>();
  for (const c of contacts) {
    const uf = (ufSigla(c.estado) || (c.estado || "").trim().toUpperCase());
    if (!uf) continue;
    const a = ufAgg.get(uf) || { total: 0, incorreto: 0, atualizado: 0 };
    a.total++;
    if (c.status === STATUS_INCORRETO) a.incorreto++;
    else if (c.status === STATUS_ATUALIZADO) a.atualizado++;
    ufAgg.set(uf, a);
  }
  const mapaUF: Record<string, { total: number; incorreto: number; atualizado: number; taxa: number | null }> = {};
  for (const [uf, a] of ufAgg) {
    const sinal = a.incorreto + a.atualizado;
    mapaUF[uf] = { ...a, taxa: sinal ? Math.round((a.atualizado / sinal) * 100) : null };
  }

  // ---- Heatmap de atividade (dia da semana × hora, em horário de Brasília UTC-3) ----
  const heat: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const addHeat = (d: Date) => {
    const brt = new Date(d.getTime() - 3 * 3600000);
    const wd = (brt.getUTCDay() + 6) % 7; // segunda = 0
    heat[wd][brt.getUTCHours()]++;
  };
  for (const fr of fillRows) if (!ldrId || fr.preenchidoPorId === ldrId) addHeat(new Date(fr.concluidoEm));
  for (const c of corrRows) if (c.resolvedAt && (!ldrId || c.resolvedById === ldrId)) addHeat(new Date(c.resolvedAt));
  const heatMax = Math.max(1, ...heat.flat());

  return {
    periodo, ldrId, campanha, now,
    ldrs, campanhas,
    kpis, ranking, rankMax, dias, serieMax,
    metasView, semaforo,
    funil, funilMax, completudePorBase, backlog,
    mapaUF, heat, heatMax,
  };
}
