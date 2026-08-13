import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isRowCompleta } from "@/lib/completude";
import { resolveBaseColumns } from "@/lib/base-columns";
import { CONTACT_FIELD_SELECT } from "@/lib/contact-fields";

let ensured = false;

// Cria a tabela "ContactFill" sob demanda (idempotente). Igual ao Meta: o banco de
// produção não pode ser migrado por fora, então a tabela nasce via SQL na primeira vez
// que é usada. Só CREATE ... IF NOT EXISTS — nunca altera/derruba nada existente.
export async function ensureContactFillTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "ContactFill" (
      "contactId" TEXT NOT NULL,
      "preenchidoPorId" TEXT NOT NULL,
      "concluidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ContactFill_pkey" PRIMARY KEY ("contactId")
    );`
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ContactFill_preenchidoPorId_idx" ON "ContactFill" ("preenchidoPorId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ContactFill_concluidoEm_idx" ON "ContactFill" ("concluidoEm");`);
  // Índice composto pra acelerar a query mais comum (contatos de uma base, não
  // excluídos) — hoje o Postgres só tinha índices separados em baseId e deletedAt.
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Contact_baseId_deletedAt_idx" ON "Contact" ("baseId", "deletedAt");`
  );
  // Histórico dos créditos que já foram perdidos (linha deixou de estar completa).
  // Tabela só de auditoria, append-only: o Prisma não a conhece e nenhuma leitura
  // do sistema depende dela — serve pra nada se perder de vez quando a régua muda.
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "ContactFillArquivo" (
      "contactId" TEXT NOT NULL,
      "preenchidoPorId" TEXT NOT NULL,
      "concluidoEm" TIMESTAMP(3) NOT NULL,
      "arquivadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ContactFillArquivo_contactId_idx" ON "ContactFillArquivo" ("contactId");`
  );
  ensured = true;
}

// Copia pro arquivo os créditos que estão prestes a ser removidos e só então
// remove. Sem isso, mudar a régua de conclusão apagaria de vez "quem completou
// e quando" — informação que as metas usam e que não dá pra recalcular depois.
async function revogarCreditos(contactIds: string[]) {
  if (contactIds.length === 0) return;
  await prisma.$executeRaw`
    INSERT INTO "ContactFillArquivo" ("contactId", "preenchidoPorId", "concluidoEm")
    SELECT "contactId", "preenchidoPorId", "concluidoEm"
    FROM "ContactFill" WHERE "contactId" IN (${Prisma.join(contactIds)})`;
  await prisma.contactFill.deleteMany({ where: { contactId: { in: contactIds } } });
}

// Recalcula a conclusão de um contato pela régua DINÂMICA: completo = todas as
// colunas VISÍVEIS daquela planilha preenchidas (fixas e personalizadas juntas).
// Atualiza o ContactFill (quem completou/quando). Chamado ao salvar qualquer
// célula e ao mexer na estrutura de colunas da base.
export async function atualizarConclusao(contactId: string, meId: string | null) {
  // Busca o contato, os valores personalizados (independem um do outro — os dois
  // só precisam do contactId, que já temos) e garante a tabela, tudo em paralelo.
  const [contact, vals] = await Promise.all([
    prisma.contact.findUnique({ where: { id: contactId }, select: { baseId: true, ...CONTACT_FIELD_SELECT } }),
    prisma.contactCustomValue.findMany({ where: { contactId }, select: { colKey: true, valor: true } }),
    ensureContactFillTable(),
  ]);
  if (!contact) return;

  const base = await prisma.base.findUnique({ where: { id: contact.baseId }, select: { headers: true } });
  const visibleKeys = resolveBaseColumns(base?.headers as Record<string, unknown> | null).map((c) => c.key);
  const customVals = Object.fromEntries(vals.map((v) => [v.colKey, v.valor ?? ""]));

  const completo = isRowCompleta(visibleKeys, contact as Record<string, unknown>, customVals);

  if (completo && meId) {
    await prisma.contactFill.upsert({
      where: { contactId },
      create: { contactId, preenchidoPorId: meId, concluidoEm: new Date() },
      update: {},
    });
  } else if (!completo) {
    await revogarCreditos([contactId]);
  }
}

// Reprocessa a conclusão de TODOS os contatos de uma base — usado quando o admin
// cria/exclui uma coluna personalizada (a régua muda). Remove o crédito dos que
// deixaram de estar completos e, se `meId` for informado, concede crédito (data de
// agora, atribuído a quem fez a alteração) aos que voltaram a ficar completos e ainda
// não tinham crédito (skipDuplicates preserva o crédito de quem já tinha).
export async function reprocessarConclusaoDaBase(baseId: string, meId: string | null = null) {
  // Base e contatos não dependem um do outro — busca os dois em paralelo.
  const [base, contatos] = await Promise.all([
    prisma.base.findUnique({ where: { id: baseId }, select: { headers: true } }),
    prisma.contact.findMany({
      where: { baseId, deletedAt: null },
      select: { id: true, ...CONTACT_FIELD_SELECT },
    }),
  ]);
  const visibleKeys = resolveBaseColumns(base?.headers as Record<string, unknown> | null).map((c) => c.key);

  const valsByContact = new Map<string, Record<string, string>>();
  const cv = await prisma.contactCustomValue.findMany({
    where: { contactId: { in: contatos.map((c) => c.id) } },
    select: { contactId: true, colKey: true, valor: true },
  });
  for (const r of cv) {
    const m = valsByContact.get(r.contactId) ?? {};
    m[r.colKey] = r.valor ?? "";
    valsByContact.set(r.contactId, m);
  }

  const completos: string[] = [];
  const incompletos: string[] = [];
  for (const c of contatos) {
    const ok = isRowCompleta(visibleKeys, c as Record<string, unknown>, valsByContact.get(c.id));
    (ok ? completos : incompletos).push(c.id);
  }

  await ensureContactFillTable();
  await revogarCreditos(incompletos);
  if (meId && completos.length) {
    await prisma.contactFill.createMany({
      data: completos.map((contactId) => ({ contactId, preenchidoPorId: meId, concluidoEm: new Date() })),
      skipDuplicates: true, // preserva o crédito de quem já tinha; cria só p/ os sem crédito
    });
  }
  return { revisados: contatos.length, completos: completos.length, semCredito: incompletos.length };
}
