import { prisma } from "@/lib/prisma";
import { isComplete, isCompleteVisivel, customsCompletos, REQUIRED_SELECT } from "@/lib/completude";
import { parseCustomCols } from "@/lib/custom-columns";
import { parseHiddenCols } from "@/lib/base-columns";
import { registrarCredito } from "@/lib/auditoria";

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
  // Dono ORIGINAL do crédito: quando a linha deixa de estar completa (alguém apaga uma célula) o
  // crédito sai do ContactFill, mas o primeiro a completar continua sendo dono — se a linha voltar
  // a ficar completa, ele recupera (mesmo que outra pessoa tenha digitado a célula de novo).
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "CreditoOriginal" (
      "contactId" TEXT NOT NULL,
      "pessoaId" TEXT NOT NULL,
      "concluidoEm" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "CreditoOriginal_pkey" PRIMARY KEY ("contactId")
    );`
  );
  // Índice composto pra acelerar a query mais comum (contatos de uma base, não
  // excluídos) — hoje o Postgres só tinha índices separados em baseId e deletedAt.
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Contact_baseId_deletedAt_idx" ON "Contact" ("baseId", "deletedAt");`
  );
  ensured = true;
}

type Cliente = Pick<typeof prisma, "contact" | "contactCustomValue" | "base">;

// A linha está completa AGORA? (7 campos da régua visíveis + colunas personalizadas visíveis,
// sem contar a coluna Validado.) Mesma regra da tela.
async function linhaCompletaCom(c: Cliente, contactId: string): Promise<boolean | null> {
  const [contact, vals] = await Promise.all([
    c.contact.findUnique({ where: { id: contactId }, select: { baseId: true, ...REQUIRED_SELECT } }),
    c.contactCustomValue.findMany({ where: { contactId }, select: { colKey: true, valor: true } }),
  ]);
  if (!contact) return null;
  const base = await c.base.findUnique({ where: { id: contact.baseId }, select: { headers: true } });
  const headers = base?.headers as Record<string, unknown> | null;
  // Coluna oculta/excluída não conta para a conclusão — MESMA regra da tela (isCompleteVisivel).
  const ocultas = new Set(parseHiddenCols(headers));
  const cols = parseCustomCols(headers).filter((col) => !ocultas.has(col.key) && col.sistema !== "validacao");
  let customOk = true;
  if (cols.length) {
    const map = new Map(vals.map((v) => [v.colKey, v.valor]));
    customOk = cols.every((col) => !!(map.get(col.key) || "").trim());
  }
  return isCompleteVisivel(contact as Parameters<typeof isComplete>[0], ocultas) && customOk;
}

// Estado ANTES de uma edição — as rotas chamam isto antes de gravar e passam o resultado
// para atualizarConclusao.
export async function linhaCompleta(contactId: string): Promise<boolean> {
  return (await linhaCompletaCom(prisma, contactId)) === true;
}

// Recalcula a conclusão de um contato e atualiza o ContactFill (quem completou/quando).
//
// REGRA DO CRÉDITO: só ganha crédito quem COMPLETA a linha — a edição levou a linha de
// incompleta para completa (quem preencheu a última célula que faltava). Mexer numa linha
// que JÁ estava completa (ex.: trocar maiúscula/minúscula) nunca dá crédito, mesmo que a
// linha ainda não tivesse dono (importações e linhas antigas). `antesCompleta` é o estado
// anterior à edição; sem ele (undefined) o crédito é dado como antes.
export async function atualizarConclusao(contactId: string, meId: string | null, antesCompleta?: boolean) {
  await ensureContactFillTable();
  // Uma colagem dispara vários salvamentos da MESMA linha ao mesmo tempo (campos fixos +
  // uma requisição por coluna personalizada). Sem serializar, um recálculo que leu o
  // estado antigo ("incompleta") apagava o crédito que outro acabara de dar. O lock por
  // contato faz cada recálculo ler o estado já gravado pelos anteriores.
  let credito: { dado: boolean; restaurado?: string } = { dado: false };
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${contactId}))`;
      const completo = await linhaCompletaCom(tx as unknown as Cliente, contactId);
      if (completo === null) return;

      if (completo) {
        const jaTem = await tx.contactFill.findUnique({ where: { contactId }, select: { contactId: true } });
        if (!jaTem) {
          // O primeiro a completar continua dono: se a linha já tinha dono (e perdeu o crédito só
          // porque uma célula foi apagada), ele recupera — quem redigitou não "rouba" a linha.
          const orig = await tx.$queryRaw<{ pessoaId: string; concluidoEm: Date }[]>`SELECT "pessoaId","concluidoEm" FROM "CreditoOriginal" WHERE "contactId" = ${contactId}`;
          if (orig[0]) {
            await tx.contactFill.create({ data: { contactId, preenchidoPorId: orig[0].pessoaId, concluidoEm: orig[0].concluidoEm } });
            await tx.$executeRaw`DELETE FROM "CreditoOriginal" WHERE "contactId" = ${contactId}`;
            credito = { dado: false, restaurado: orig[0].pessoaId };
          } else if (meId && antesCompleta !== true) {
            await tx.contactFill.create({ data: { contactId, preenchidoPorId: meId, concluidoEm: new Date() } });
            credito = { dado: true };
          }
        }
      } else {
        const ex = await tx.contactFill.findUnique({ where: { contactId }, select: { preenchidoPorId: true, concluidoEm: true } });
        if (ex) {
          await tx.$executeRaw`INSERT INTO "CreditoOriginal" ("contactId","pessoaId","concluidoEm") VALUES (${contactId}, ${ex.preenchidoPorId}, ${ex.concluidoEm}) ON CONFLICT ("contactId") DO UPDATE SET "pessoaId" = EXCLUDED."pessoaId", "concluidoEm" = EXCLUDED."concluidoEm"`;
          await tx.contactFill.deleteMany({ where: { contactId } });
        }
      }
    },
    { timeout: 10000 }
  );
  if (credito.restaurado) await registrarCredito({ contactId, acao: "dado", paraPessoaId: credito.restaurado, motivo: "linha voltou a ficar completa: crédito de volta ao primeiro a completar", porId: meId });
  if (credito.dado) await registrarCredito({ contactId, acao: "dado", paraPessoaId: meId, motivo: "completou a linha", porId: meId });
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
  const cols = parseCustomCols(base?.headers as Record<string, unknown> | null).filter((c) => !ocultas.has(c.key) && c.sistema !== "validacao");

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
  if (incompletos.length) {
    // Guarda o dono original antes de tirar o crédito; ao voltar a ficar completa, ele recupera.
    await prisma.$executeRaw`INSERT INTO "CreditoOriginal" ("contactId","pessoaId","concluidoEm") SELECT "contactId","preenchidoPorId","concluidoEm" FROM "ContactFill" WHERE "contactId" = ANY(${incompletos}) ON CONFLICT ("contactId") DO UPDATE SET "pessoaId" = EXCLUDED."pessoaId", "concluidoEm" = EXCLUDED."concluidoEm"`;
    await prisma.contactFill.deleteMany({ where: { contactId: { in: incompletos } } });
  }
  if (completos.length) {
    await prisma.$executeRaw`INSERT INTO "ContactFill" ("contactId","preenchidoPorId","concluidoEm") SELECT "contactId","pessoaId","concluidoEm" FROM "CreditoOriginal" WHERE "contactId" = ANY(${completos}) ON CONFLICT ("contactId") DO NOTHING`;
    await prisma.$executeRaw`DELETE FROM "CreditoOriginal" WHERE "contactId" = ANY(${completos}) AND EXISTS (SELECT 1 FROM "ContactFill" f WHERE f."contactId" = "CreditoOriginal"."contactId")`;
  }
  if (meId && completos.length) {
    await prisma.contactFill.createMany({
      data: completos.map((contactId) => ({ contactId, preenchidoPorId: meId, concluidoEm: new Date() })),
      skipDuplicates: true, // preserva o crédito de quem já tinha; cria só p/ os sem crédito
    });
  }
  return { revisados: contatos.length, completos: completos.length, semCredito: incompletos.length };
}
