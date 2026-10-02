// Lixeira de planilhas (bases) apagadas: antes de apagar, guarda uma CÓPIA COMPLETA
// (base, contatos, valores de colunas personalizadas, correções e créditos de
// preenchimento) por 30 dias. Restaurar recoloca tudo com os MESMOS ids.
// Tabela criada sob demanda (padrão do projeto: o banco não roda migration por fora).
import { prisma } from "@/lib/prisma";
import { ensureContactCustomTable } from "@/lib/custom-columns";
import { ensureContactFillTable } from "@/lib/contact-fill";

export const DIAS_NA_LIXEIRA = 30;
let ensured = false;

export async function ensureLixeiraTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "BaseLixeira" (
      "id" TEXT NOT NULL,
      "baseId" TEXT NOT NULL,
      "nome" TEXT NOT NULL,
      "apagadoPorId" TEXT,
      "apagadoPorNome" TEXT,
      "apagadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "contatos" INTEGER NOT NULL DEFAULT 0,
      "dados" JSONB NOT NULL,
      CONSTRAINT "BaseLixeira_pkey" PRIMARY KEY ("id")
    );`
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BaseLixeira_apagadoEm_idx" ON "BaseLixeira" ("apagadoEm");`);
  ensured = true;
}

// Guarda a cópia e apaga a base (cascata nos contatos) NA MESMA transação: ou faz as
// duas coisas ou nenhuma — nunca apaga sem ter guardado.
export async function arquivarEApagarBase(baseId: string, quem: { id?: string | null; nome?: string | null }) {
  await Promise.all([ensureLixeiraTable(), ensureContactCustomTable(), ensureContactFillTable()]);
  const base = await prisma.base.findUnique({ where: { id: baseId }, select: { id: true, name: true } });
  if (!base) return false;
  const lixeiraId = `lx_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  await prisma.$transaction([
    prisma.$executeRawUnsafe(
      `INSERT INTO "BaseLixeira" ("id","baseId","nome","apagadoPorId","apagadoPorNome","contatos","dados")
       SELECT $2, $1, $3, $4, $5,
         (SELECT count(*)::int FROM "Contact" WHERE "baseId"=$1 AND "deletedAt" IS NULL),
         jsonb_build_object(
           'base', (SELECT to_jsonb(b) FROM "Base" b WHERE b.id=$1),
           'contatos', coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM "Contact" c WHERE c."baseId"=$1), '[]'::jsonb),
           'valores', coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM "ContactCustomValue" v JOIN "Contact" c ON c.id=v."contactId" WHERE c."baseId"=$1), '[]'::jsonb),
           'correcoes', coalesce((SELECT jsonb_agg(to_jsonb(k)) FROM "Correction" k JOIN "Contact" c ON c.id=k."contactId" WHERE c."baseId"=$1), '[]'::jsonb),
           'fills', coalesce((SELECT jsonb_agg(to_jsonb(f)) FROM "ContactFill" f JOIN "Contact" c ON c.id=f."contactId" WHERE c."baseId"=$1), '[]'::jsonb)
         )`,
      baseId, lixeiraId, base.name, quem.id ?? null, quem.nome ?? null
    ),
    prisma.base.delete({ where: { id: baseId } }),
  ]);
  return true;
}

export type ItemLixeira = { id: string; baseId: string; nome: string; apagadoPorNome: string | null; apagadoEm: Date; contatos: number };

export async function listarLixeira(): Promise<ItemLixeira[]> {
  await ensureLixeiraTable();
  // Limpa o que passou do prazo.
  await prisma.$executeRawUnsafe(`DELETE FROM "BaseLixeira" WHERE "apagadoEm" < NOW() - INTERVAL '${DIAS_NA_LIXEIRA} days'`);
  return prisma.$queryRawUnsafe<ItemLixeira[]>(
    `SELECT "id","baseId","nome","apagadoPorNome","apagadoEm","contatos" FROM "BaseLixeira" ORDER BY "apagadoEm" DESC`
  );
}

export async function contarLixeira(): Promise<number> {
  await ensureLixeiraTable();
  const r = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "BaseLixeira"`);
  return r[0]?.n ?? 0;
}

type Dados = {
  base: Record<string, unknown>;
  contatos: Record<string, unknown>[];
  valores: Record<string, unknown>[];
  correcoes: Record<string, unknown>[];
  fills: Record<string, unknown>[];
};

export async function restaurarBase(lixeiraId: string): Promise<{ ok: true; baseId: string } | { ok: false; erro: string }> {
  await Promise.all([ensureLixeiraTable(), ensureContactCustomTable(), ensureContactFillTable()]);
  const rows = await prisma.$queryRawUnsafe<{ baseId: string; dados: Dados }[]>(`SELECT "baseId","dados" FROM "BaseLixeira" WHERE "id"=$1`, lixeiraId);
  const item = rows[0];
  if (!item) return { ok: false, erro: "Item não encontrado na lixeira (talvez já tenha passado de 30 dias)." };
  if (await prisma.base.findUnique({ where: { id: item.baseId }, select: { id: true } })) {
    return { ok: false, erro: "Essa planilha já existe — nada a restaurar." };
  }

  // Usuários que ainda existem: referências a quem foi removido viram vazias (senão a
  // chave estrangeira recusaria a linha).
  const usuarios = new Set((await prisma.user.findMany({ select: { id: true } })).map((u) => u.id));
  const limpa = (o: Record<string, unknown>, campos: string[]) => {
    for (const c of campos) if (o[c] && !usuarios.has(String(o[c]))) o[c] = null;
    return o;
  };
  const d = item.dados;
  const contatos = d.contatos.map((c) => limpa({ ...c }, ["createdById"]));
  const correcoes = d.correcoes.map((c) => limpa({ ...c }, ["createdById", "resolvedById"]));

  await prisma.$transaction([
    prisma.$executeRawUnsafe(`INSERT INTO "Base" SELECT * FROM jsonb_populate_record(null::"Base", $1::jsonb)`, JSON.stringify(d.base)),
    prisma.$executeRawUnsafe(`INSERT INTO "Contact" SELECT * FROM jsonb_populate_recordset(null::"Contact", $1::jsonb)`, JSON.stringify(contatos)),
    prisma.$executeRawUnsafe(`INSERT INTO "ContactCustomValue" SELECT * FROM jsonb_populate_recordset(null::"ContactCustomValue", $1::jsonb) ON CONFLICT DO NOTHING`, JSON.stringify(d.valores)),
    prisma.$executeRawUnsafe(`INSERT INTO "Correction" SELECT * FROM jsonb_populate_recordset(null::"Correction", $1::jsonb)`, JSON.stringify(correcoes)),
    prisma.$executeRawUnsafe(`INSERT INTO "ContactFill" SELECT * FROM jsonb_populate_recordset(null::"ContactFill", $1::jsonb) ON CONFLICT DO NOTHING`, JSON.stringify(d.fills)),
    prisma.$executeRawUnsafe(`DELETE FROM "BaseLixeira" WHERE "id"=$1`, lixeiraId),
  ]);
  return { ok: true, baseId: item.baseId };
}

export async function apagarDefinitivo(lixeiraId: string) {
  await ensureLixeiraTable();
  await prisma.$executeRawUnsafe(`DELETE FROM "BaseLixeira" WHERE "id"=$1`, lixeiraId);
}
