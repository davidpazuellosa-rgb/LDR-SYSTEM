import { prisma } from "@/lib/prisma";
import { isComplete, customsCompletos, REQUIRED_SELECT } from "@/lib/completude";
import { parseCustomCols } from "@/lib/custom-columns";

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
  ensured = true;
}

// Recalcula a conclusão de um contato: completo = 7 campos fixos da régua
// preenchidos E todas as colunas personalizadas da base preenchidas. Atualiza o
// ContactFill (quem completou/quando) de acordo. Chamado ao salvar campo fixo ou
// valor de coluna personalizada.
export async function atualizarConclusao(contactId: string, meId: string | null) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { baseId: true, ...REQUIRED_SELECT },
  });
  if (!contact) return;

  const base = await prisma.base.findUnique({ where: { id: contact.baseId }, select: { headers: true } });
  const cols = parseCustomCols(base?.headers as Record<string, unknown> | null);

  let customOk = true;
  if (cols.length) {
    const vals = await prisma.contactCustomValue.findMany({ where: { contactId }, select: { colKey: true, valor: true } });
    const map = new Map(vals.map((v) => [v.colKey, v.valor]));
    customOk = cols.every((c) => !!(map.get(c.key) || "").trim());
  }

  const completo = isComplete(contact as Parameters<typeof isComplete>[0]) && customOk;

  await ensureContactFillTable();
  if (completo && meId) {
    await prisma.contactFill.upsert({
      where: { contactId },
      create: { contactId, preenchidoPorId: meId, concluidoEm: new Date() },
      update: {},
    });
  } else if (!completo) {
    await prisma.contactFill.deleteMany({ where: { contactId } });
  }
}

// Reprocessa a conclusão de TODOS os contatos de uma base — usado quando o admin
// cria/exclui uma coluna personalizada (a régua muda). Remove o crédito dos que
// deixaram de estar completos e, se `meId` for informado, concede crédito (data de
// agora, atribuído a quem fez a alteração) aos que voltaram a ficar completos e ainda
// não tinham crédito (skipDuplicates preserva o crédito de quem já tinha).
export async function reprocessarConclusaoDaBase(baseId: string, meId: string | null = null) {
  const base = await prisma.base.findUnique({ where: { id: baseId }, select: { headers: true } });
  const cols = parseCustomCols(base?.headers as Record<string, unknown> | null);
  const contatos = await prisma.contact.findMany({
    where: { baseId, deletedAt: null },
    select: { id: true, ...REQUIRED_SELECT },
  });

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
    const ok = isComplete(c as Parameters<typeof isComplete>[0]) && customsCompletos(keys, valsByContact.get(c.id));
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
