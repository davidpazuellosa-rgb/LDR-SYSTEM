import { prisma } from "@/lib/prisma";

let ensured = false;

// Cria a tabela "Meta" sob demanda (idempotente). O banco de produção não pode ser
// migrado por fora, então criamos a tabela via SQL na primeira vez que ela é usada.
// Só faz CREATE ... IF NOT EXISTS — nunca altera/derruba nada existente.
export async function ensureMetaTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "Meta" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "baseId" TEXT NOT NULL,
      "estado" TEXT NOT NULL,
      "prazo" TEXT NOT NULL DEFAULT 'semanal',
      "corrigidos" INTEGER NOT NULL DEFAULT 0,
      "preenchidos" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "Meta_pkey" PRIMARY KEY ("id")
    );`
  );
  // Para tabelas já criadas antes do campo "prazo" existir.
  await prisma.$executeRawUnsafe(`ALTER TABLE "Meta" ADD COLUMN IF NOT EXISTS "prazo" TEXT NOT NULL DEFAULT 'semanal';`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Meta_userId_baseId_estado_key" ON "Meta" ("userId", "baseId", "estado");`
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Meta_userId_idx" ON "Meta" ("userId");`);
  ensured = true;
}
