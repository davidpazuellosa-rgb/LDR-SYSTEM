import { prisma } from "@/lib/prisma";

let ensured = false;

// Cria a tabela "BaseEvento" sob demanda (idempotente). O banco de produção não
// pode ser migrado por fora, então criamos via SQL na primeira vez que é usada.
// Só faz CREATE ... IF NOT EXISTS — nunca altera/derruba nada existente.
export async function ensureBaseEventoTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "BaseEvento" (
      "id" TEXT NOT NULL,
      "baseId" TEXT NOT NULL,
      "tipo" TEXT NOT NULL,
      "usuarioId" TEXT,
      "usuarioNome" TEXT,
      "detalhes" JSONB,
      "snapshot" JSONB,
      "desfeitoEm" TIMESTAMP(3),
      "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BaseEvento_pkey" PRIMARY KEY ("id")
    );`
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BaseEvento_baseId_idx" ON "BaseEvento" ("baseId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BaseEvento_criadoEm_idx" ON "BaseEvento" ("criadoEm");`);
  ensured = true;
}

// Snapshots guardados para permitir DESFAZER cada tipo de ação.
export type MergeSnapshot = {
  kind: "merge";
  createdIds: string[]; // contatos criados (desfazer = soft-delete)
  fills: { contactId: string; fields: string[] }[]; // campos preenchidos (desfazer = limpar)
};

export type ReplaceSnapshot = {
  kind: "replace";
  deletedIds: string[]; // contatos antigos soft-deletados (desfazer = restaurar)
  createdIds: string[]; // contatos novos importados (desfazer = soft-delete)
  oldHeaders: Record<string, string>; // rótulos de coluna antes (desfazer = restaurar)
};

export type CellEditSnapshot = {
  kind: "cell_edit";
  contactId: string;
  fields: { campo: string; oldValue: string | null }[]; // desfazer = volta cada campo ao oldValue
};

export type EventoSnapshot = MergeSnapshot | ReplaceSnapshot | CellEditSnapshot;
