// Trilha de auditoria (tabelas criadas sob demanda, como ContactFill):
//  - CelulaLog: cada alteração de célula (quem, antes, depois, quando) — guardada por 90 dias;
//  - CreditoLog: cada crédito de preenchimento dado, removido ou reatribuído, com motivo.
import { prisma } from "@/lib/prisma";

export const DIAS_CELULA_LOG = 90;

let ensured = false;
export async function ensureAuditoriaTables() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "CelulaLog" (
      "id" TEXT NOT NULL,
      "baseId" TEXT,
      "contactId" TEXT NOT NULL,
      "campo" TEXT NOT NULL,
      "de" TEXT,
      "para" TEXT,
      "porId" TEXT,
      "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CelulaLog_pkey" PRIMARY KEY ("id")
    );`
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CelulaLog_contactId_em_idx" ON "CelulaLog" ("contactId", "em");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CelulaLog_porId_em_idx" ON "CelulaLog" ("porId", "em");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CelulaLog_em_idx" ON "CelulaLog" ("em");`);
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "CreditoLog" (
      "id" TEXT NOT NULL,
      "contactId" TEXT NOT NULL,
      "acao" TEXT NOT NULL,
      "dePessoaId" TEXT,
      "paraPessoaId" TEXT,
      "motivo" TEXT,
      "porId" TEXT,
      "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CreditoLog_pkey" PRIMARY KEY ("id")
    );`
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CreditoLog_contactId_idx" ON "CreditoLog" ("contactId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CreditoLog_em_idx" ON "CreditoLog" ("em");`);
  ensured = true;
}

const novoId = () => `lg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
const corta = (v: string | null | undefined) => (v == null ? null : String(v).slice(0, 500));

export type MudancaCelula = { campo: string; de: string | null; para: string | null };

// Registra as alterações reais de uma ou mais células de um contato (melhor esforço: a
// auditoria nunca pode impedir o salvamento da edição).
export async function registrarCelulas(baseId: string | null, contactId: string, porId: string | null, mudancas: MudancaCelula[]) {
  const reais = mudancas.filter((m) => (m.de ?? "") !== (m.para ?? ""));
  if (reais.length === 0) return;
  try {
    await ensureAuditoriaTables();
    await prisma.$transaction(
      reais.map((m) =>
        prisma.$executeRaw`INSERT INTO "CelulaLog" ("id","baseId","contactId","campo","de","para","porId") VALUES (${novoId()}, ${baseId}, ${contactId}, ${m.campo}, ${corta(m.de)}, ${corta(m.para)}, ${porId})`
      )
    );
  } catch (e) {
    console.error("auditoria: falha ao registrar célula", e);
  }
}

// Apaga o histórico de células com mais de 90 dias (chamado pelo cron diário).
export async function limparCelulaLog(): Promise<number> {
  await ensureAuditoriaTables();
  return prisma.$executeRaw`DELETE FROM "CelulaLog" WHERE "em" < NOW() - (${DIAS_CELULA_LOG} || ' days')::interval`;
}

// ---- Alerta de crédito suspeito ----
// Muitos créditos em pouco tempo costumam ser edição em massa de linhas que já estavam
// prontas. Limiares: pico por hora e total em 24 h (equipe normal: ~40–70 por dia).
export const LIMITE_POR_HORA = 100;
export const LIMITE_POR_DIA = 300;

export type PessoaSuspeita = { id: string; nome: string; total24h: number; picoHora: number };

export function avaliarSuspeitos(
  rows: { pessoaId: string; nome: string; hora: Date; qtd: number }[]
): PessoaSuspeita[] {
  const por = new Map<string, PessoaSuspeita>();
  for (const r of rows) {
    const p = por.get(r.pessoaId) ?? { id: r.pessoaId, nome: r.nome, total24h: 0, picoHora: 0 };
    p.total24h += r.qtd;
    p.picoHora = Math.max(p.picoHora, r.qtd);
    por.set(r.pessoaId, p);
  }
  return [...por.values()]
    .filter((p) => p.picoHora >= LIMITE_POR_HORA || p.total24h >= LIMITE_POR_DIA)
    .sort((a, b) => b.total24h - a.total24h);
}

export async function creditosSuspeitos(): Promise<PessoaSuspeita[]> {
  const rows = await prisma.$queryRaw<{ pessoaId: string; nome: string | null; hora: Date; qtd: bigint }[]>`
    SELECT f."preenchidoPorId" AS "pessoaId", COALESCE(u."name", u."email") AS nome, date_trunc('hour', f."concluidoEm") AS hora, count(*) AS qtd
    FROM "ContactFill" f LEFT JOIN "User" u ON u.id = f."preenchidoPorId"
    WHERE f."concluidoEm" > NOW() - INTERVAL '24 hours'
    GROUP BY 1, 2, 3`;
  return avaliarSuspeitos(rows.map((r) => ({ pessoaId: r.pessoaId, nome: r.nome || "—", hora: r.hora, qtd: Number(r.qtd) })));
}

export async function registrarCredito(a: { contactId: string; acao: "dado" | "removido" | "reatribuido"; dePessoaId?: string | null; paraPessoaId?: string | null; motivo?: string | null; porId?: string | null }) {
  try {
    await ensureAuditoriaTables();
    await prisma.$executeRaw`INSERT INTO "CreditoLog" ("id","contactId","acao","dePessoaId","paraPessoaId","motivo","porId") VALUES (${novoId()}, ${a.contactId}, ${a.acao}, ${a.dePessoaId ?? null}, ${a.paraPessoaId ?? null}, ${corta(a.motivo)}, ${a.porId ?? null})`;
  } catch (e) {
    console.error("auditoria: falha ao registrar crédito", e);
  }
}
