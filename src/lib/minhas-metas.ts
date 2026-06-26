// "Minhas Metas" (visão do próprio LDR): metas ativas, histórico retroativo e
// conquistas. Histórico é calculado dos timestamps (ContactFill/Correction) contra o
// alvo atual — sem versionar (ver planejamento). Reaproveita a lógica de meta-progress.
import { prisma } from "@/lib/prisma";
import { ufSigla } from "@/lib/uf";
import { tipoOrgao } from "@/lib/completude";
import { normCampanha } from "@/lib/campanhas";
import { regiaoKey, periodStart, startOfMonth, startOfWeek, type Meta, type Fill, type CorrDone } from "@/lib/meta-progress";
import { ensureMetaTable } from "@/lib/meta";
import { ensureContactFillTable } from "@/lib/contact-fill";

export type StatusMeta = "ok" | "risco" | "atrasado";

function feitoNoPeriodo(m: Meta, fills: Fill[], corrections: CorrDone[], start: Date, end: Date): number {
  if (m.tipo === "correcao") {
    const camp = normCampanha(m.campanha);
    return corrections.filter((c) => c.resolvedById === m.userId && c.resolvedAt && c.resolvedAt >= start && c.resolvedAt < end && normCampanha(c.campanha) === camp).length;
  }
  return fills.filter((f) => f.concluidoEm >= start && f.concluidoEm < end && f.baseId === m.baseId && regiaoKey(f.regiao) === m.regiao && ufSigla(f.estado) === m.estado).length;
}

function statusDe(feito: number, alvo: number, decorrido: number): StatusMeta {
  const p = alvo > 0 ? feito / alvo : feito > 0 ? 1 : 0;
  if (p >= 1) return "ok";
  const esperado = alvo * decorrido;
  if (feito >= esperado) return "ok";
  if (feito >= esperado * 0.6) return "risco";
  return "atrasado";
}

// Pior situação entre as metas (verde < âmbar < vermelho) — para o ponto na sidebar.
const pior = (a: StatusMeta | null, b: StatusMeta): StatusMeta => {
  const ordem = { ok: 0, risco: 1, atrasado: 2 } as const;
  if (!a) return b;
  return ordem[b] > ordem[a] ? b : a;
};

function rotuloMeta(m: Meta, baseName: (id: string | null) => string): string {
  return m.tipo === "correcao"
    ? `Campanha: ${m.campanha || "—"}`
    : `${tipoOrgao(baseName(m.baseId))} · ${m.regiao || "—"} · ${ufSigla(m.estado) || m.estado || "—"}`;
}

function janelasPassadas(prazo: string, now: Date, quantas: number) {
  const wins: { start: Date; end: Date; label: string }[] = [];
  for (let i = quantas; i >= 1; i--) {
    if (prazo === "mensal") {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      wins.push({ start, end, label: start.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") });
    } else {
      const start = new Date(startOfWeek(now).getTime() - i * 7 * 86400000);
      const end = new Date(start.getTime() + 7 * 86400000);
      wins.push({ start, end, label: `${start.getDate()}/${start.getMonth() + 1}` });
    }
  }
  return wins;
}

type MetaComData = Meta & { criadoEm: Date };

async function lerVistoEm(userId: string): Promise<Date | null> {
  const rows = await prisma.$queryRaw<{ vistoEm: Date }[]>`SELECT "vistoEm" FROM "MetaVisto" WHERE "userId" = ${userId}`;
  return rows[0]?.vistoEm ?? null;
}
async function marcarVisto(userId: string) {
  await prisma.$executeRaw`INSERT INTO "MetaVisto" ("userId", "vistoEm") VALUES (${userId}, NOW()) ON CONFLICT ("userId") DO UPDATE SET "vistoEm" = NOW()`;
}
function temMetaNova(metas: MetaComData[], vistoEm: Date | null): boolean {
  if (metas.length === 0) return false;
  if (!vistoEm) return true;
  return metas.some((m) => m.criadoEm > vistoEm);
}

// Chave determinística de um snapshot (identidade da meta + início do período).
function chaveSnap(
  m: { userId: string; tipo: string; baseId: string | null; regiao: string | null; estado: string | null; campanha: string | null },
  start: Date,
): string {
  return [m.userId, m.tipo, m.baseId || "", m.regiao || "", m.estado || "", m.campanha || "", start.toISOString().slice(0, 10)].join("|");
}

async function carregar(userId: string, desde: Date) {
  await ensureMetaTable();
  await ensureContactFillTable();
  const metas = (await prisma.meta.findMany({ where: { userId } })) as MetaComData[];
  if (metas.length === 0) return { metas, fills: [] as Fill[], corrections: [] as CorrDone[], baseName: (() => "Base") as (id: string | null) => string };

  const [fillRows, corrRows, bases] = await Promise.all([
    prisma.contactFill.findMany({ where: { concluidoEm: { gte: desde } }, select: { contactId: true, concluidoEm: true } }),
    prisma.correction.findMany({
      where: { resolvedById: userId, status: "resolved", resolvedAt: { gte: desde, not: null } },
      select: { resolvedAt: true, contact: { select: { campanha: true } } },
    }),
    prisma.base.findMany({ select: { id: true, name: true } }),
  ]);
  const ids = Array.from(new Set(fillRows.map((f) => f.contactId)));
  const contacts = ids.length
    ? await prisma.contact.findMany({ where: { id: { in: ids } }, select: { id: true, baseId: true, regiao: true, estado: true } })
    : [];
  const terr = new Map(contacts.map((c) => [c.id, c]));
  const fills: Fill[] = [];
  for (const f of fillRows) {
    const c = terr.get(f.contactId);
    if (c) fills.push({ concluidoEm: f.concluidoEm, baseId: c.baseId, regiao: c.regiao, estado: c.estado });
  }
  const corrections: CorrDone[] = corrRows.map((r) => ({ resolvedById: userId, resolvedAt: r.resolvedAt, campanha: r.contact.campanha }));
  const nomes = new Map(bases.map((b) => [b.id, b.name]));
  const baseName = (id: string | null) => nomes.get(id || "") || "Base";
  return { metas, fills, corrections, baseName };
}

// Situação resumida (para o ponto na sidebar) — só o período atual, leve.
// Também devolve se há "meta nova" (criada depois da última vez que o LDR abriu a página).
export async function statusMinhasMetas(userId: string): Promise<{ status: StatusMeta | null; nova: boolean }> {
  const now = new Date();
  const desde = new Date(Math.min(startOfWeek(now).getTime(), startOfMonth(now).getTime()));
  const { metas, fills, corrections } = await carregar(userId, desde);
  if (metas.length === 0) return { status: null, nova: false };
  let worst: StatusMeta | null = null;
  for (const m of metas) {
    const ini = periodStart(m.prazo, now);
    const fim = m.prazo === "mensal" ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : new Date(ini.getTime() + 7 * 86400000);
    const decorrido = Math.min(1, Math.max(0, (now.getTime() - ini.getTime()) / (fim.getTime() - ini.getTime())));
    const feito = feitoNoPeriodo(m, fills, corrections, ini, new Date(now.getTime() + 1));
    worst = pior(worst, statusDe(feito, m.alvo, decorrido));
  }
  const nova = temMetaNova(metas, await lerVistoEm(userId));
  return { status: worst, nova };
}

// Grava o resultado CONGELADO das metas do período recém-encerrado (chamado pelo cron).
// Idempotente: a chave única evita duplicar se rodar mais de uma vez no mesmo período.
export async function snapshotMetas(now = new Date()) {
  await ensureMetaTable();
  await ensureContactFillTable();
  const metas = (await prisma.meta.findMany()) as MetaComData[];
  if (metas.length === 0) return { criados: 0 };

  const prevWeekStart = new Date(startOfWeek(now).getTime() - 7 * 86400000);
  const prevWeekEnd = startOfWeek(now);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = startOfMonth(now);
  const desde = prevMonthStart < prevWeekStart ? prevMonthStart : prevWeekStart;

  const [fillRows, corrRows] = await Promise.all([
    prisma.contactFill.findMany({ where: { concluidoEm: { gte: desde } }, select: { contactId: true, concluidoEm: true } }),
    prisma.correction.findMany({
      where: { status: "resolved", resolvedAt: { gte: desde, not: null } },
      select: { resolvedById: true, resolvedAt: true, contact: { select: { campanha: true } } },
    }),
  ]);
  const ids = Array.from(new Set(fillRows.map((f) => f.contactId)));
  const contacts = ids.length
    ? await prisma.contact.findMany({ where: { id: { in: ids } }, select: { id: true, baseId: true, regiao: true, estado: true } })
    : [];
  const terr = new Map(contacts.map((c) => [c.id, c]));
  const fills: Fill[] = [];
  for (const f of fillRows) {
    const c = terr.get(f.contactId);
    if (c) fills.push({ concluidoEm: f.concluidoEm, baseId: c.baseId, regiao: c.regiao, estado: c.estado });
  }
  const corrections: CorrDone[] = corrRows.map((r) => ({ resolvedById: r.resolvedById, resolvedAt: r.resolvedAt, campanha: r.contact.campanha }));

  const data = metas.map((m) => {
    const [start, end] = m.prazo === "mensal" ? [prevMonthStart, prevMonthEnd] : [prevWeekStart, prevWeekEnd];
    return {
      userId: m.userId, tipo: m.tipo, baseId: m.baseId, regiao: m.regiao, estado: m.estado, campanha: m.campanha,
      prazo: m.prazo, alvo: m.alvo, feito: feitoNoPeriodo(m, fills, corrections, start, end),
      periodoInicio: start, chave: chaveSnap(m, start),
    };
  });
  const res = await prisma.metaSnapshot.createMany({ data, skipDuplicates: true });
  return { criados: res.count };
}

// Dados completos para a página Minhas Metas.
export async function buildMinhasMetas(userId: string) {
  const now = new Date();
  const desde = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 7, 1)); // cobre 8 semanas e 6 meses
  const { metas, fills, corrections, baseName } = await carregar(userId, desde);
  const snaps = await prisma.metaSnapshot.findMany({ where: { userId }, select: { chave: true, feito: true, alvo: true } });
  const snapByChave = new Map(snaps.map((s) => [s.chave, s] as const));

  const ativas = metas.map((m) => {
    const ini = periodStart(m.prazo, now);
    const fim = m.prazo === "mensal" ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : new Date(ini.getTime() + 7 * 86400000);
    const decorrido = Math.min(1, Math.max(0, (now.getTime() - ini.getTime()) / (fim.getTime() - ini.getTime())));
    const feito = feitoNoPeriodo(m, fills, corrections, ini, new Date(now.getTime() + 1));
    const p = m.alvo > 0 ? Math.min(100, Math.round((feito / m.alvo) * 100)) : feito > 0 ? 100 : 0;
    return {
      id: m.id, tipo: m.tipo, prazo: m.prazo, rotulo: rotuloMeta(m, baseName),
      feito, alvo: m.alvo, p, esperado: Math.round(m.alvo * decorrido),
      status: statusDe(feito, m.alvo, decorrido),
    };
  });

  const historico = metas.map((m) => {
    const quantas = m.prazo === "mensal" ? 6 : 8;
    const periodos = janelasPassadas(m.prazo, now, quantas).map((w) => {
      // Usa o snapshot congelado se existir; senão recalcula retroativamente.
      const snap = snapByChave.get(chaveSnap(m, w.start));
      const feito = snap ? snap.feito : feitoNoPeriodo(m, fills, corrections, w.start, w.end);
      const alvo = snap ? snap.alvo : m.alvo;
      return { label: w.label, feito, alvo, hit: alvo > 0 && feito >= alvo };
    });
    // Sequência (streak): períodos batidos consecutivos a partir do mais recente.
    let streak = 0;
    for (let i = periodos.length - 1; i >= 0; i--) {
      if (periodos[i].hit) streak++;
      else break;
    }
    return { id: m.id, tipo: m.tipo, prazo: m.prazo, rotulo: rotuloMeta(m, baseName), periodos, streak };
  });

  const conquistas = {
    batendoAgora: ativas.filter((a) => a.p >= 100).length,
    totalAtivas: ativas.length,
    batidasHistorico: historico.reduce((acc, h) => acc + h.periodos.filter((p) => p.hit).length, 0),
    melhorSequencia: historico.reduce((acc, h) => Math.max(acc, h.streak), 0),
  };

  const status = ativas.reduce<StatusMeta | null>((acc, a) => pior(acc, a.status), null);

  // Abrir a página = "vi minhas metas": limpa o sinal de meta nova na sidebar.
  if (userId && metas.length > 0) await marcarVisto(userId);

  return { ativas, historico, conquistas, status };
}
