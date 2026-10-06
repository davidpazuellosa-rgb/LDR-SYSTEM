import { prisma } from "@/lib/prisma";
import { isComplete, isCompleteVisivel, customsCompletos, REQUIRED_SELECT } from "@/lib/completude";
import { parseCustomCols } from "@/lib/custom-columns";
import { parseHiddenCols } from "@/lib/base-columns";

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
  ensured = true;
}

// Recalcula a conclusão de um contato: completo = 7 campos fixos da régua
// preenchidos E todas as colunas personalizadas da base preenchidas. Atualiza o
// ContactFill (quem completou/quando) de acordo. Chamado ao salvar campo fixo ou
// valor de coluna personalizada.
export async function atualizarConclusao(contactId: string, meId: string | null) {
  await ensureContactFillTable();
  // Uma colagem dispara vários salvamentos da MESMA linha ao mesmo tempo (campos fixos +
  // uma requisição por coluna personalizada). Sem serializar, um recálculo que leu o
  // estado antigo ("incompleta") apagava o crédito que outro acabara de dar. O lock por
  // contato faz cada recálculo ler o estado já gravado pelos anteriores.
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${contactId}))`;

      const [contact, vals] = await Promise.all([
        tx.contact.findUnique({ where: { id: contactId }, select: { baseId: true, ...REQUIRED_SELECT } }),
        tx.contactCustomValue.findMany({ where: { contactId }, select: { colKey: true, valor: true } }),
      ]);
      if (!contact) return;

      const base = await tx.base.findUnique({ where: { id: contact.baseId }, select: { headers: true } });
      const headers = base?.headers as Record<string, unknown> | null;
      // Coluna oculta/excluída não conta para a conclusão — MESMA regra da tela
      // (isCompleteVisivel). Antes o servidor exigia as 7 fixas e ninguém era creditado.
      const ocultas = new Set(parseHiddenCols(headers));
      const cols = parseCustomCols(headers).filter((c) => !ocultas.has(c.key));

      let customOk = true;
      if (cols.length) {
        const map = new Map(vals.map((v) => [v.colKey, v.valor]));
        customOk = cols.every((c) => !!(map.get(c.key) || "").trim());
      }

      const completo = isCompleteVisivel(contact as Parameters<typeof isComplete>[0], ocultas) && customOk;

      if (completo && meId) {
        await tx.contactFill.upsert({
          where: { contactId },
          create: { contactId, preenchidoPorId: meId, concluidoEm: new Date() },
          update: {},
        });
      } else if (!completo) {
        await tx.contactFill.deleteMany({ where: { contactId } });
      }
    },
    { timeout: 10000 }
  );
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
      select: { id: true, ...REQUIRED_SELECT },
    }),
  ]);
  const ocultas = new Set(parseHiddenCols(base?.headers as Record<string, unknown> | null));
  const cols = parseCustomCols(base?.headers as Record<string, unknown> | null).filter((c) => !ocultas.has(c.key));

  const valsByContact = new Map<string, Record<string, string>>();
  if (cols.length) {
    const cv = await prisma.contactCustomValue.findMany({
      where: { contactId: { in: contatos.map((c) => c.id) } },
      select: { contactId: true, colKey: true, valor: true },
    });
    for (const r of cv) {
      const m = valsByContact.get(r.contactId) ?? {};
      m[r.colKey] = r.valor ?? "";
      valsByContact.set(r.contactId, m);
    }
  }

  const keys = cols.map((c) => c.key);
  const completos: string[] = [];
  const incompletos: string[] = [];
  for (const c of contatos) {
    const ok = isCompleteVisivel(c as Parameters<typeof isComplete>[0], ocultas) && customsCompletos(keys, valsByContact.get(c.id));
    (ok ? completos : incompletos).push(c.id);
  }

  await ensureContactFillTable();
  if (incompletos.length) await prisma.contactFill.deleteMany({ where: { contactId: { in: incompletos } } });
  if (meId && completos.length) {
    await prisma.contactFill.createMany({
      data: completos.map((contactId) => ({ contactId, preenchidoPorId: meId, concluidoEm: new Date() })),
      skipDuplicates: true, // preserva o crédito de quem já tinha; cria só p/ os sem crédito
    });
  }
  return { revisados: contatos.length, completos: completos.length, semCredito: incompletos.length };
}
