import { prisma } from "@/lib/prisma";

let ensured = false;

// Cria a tabela "ContactValidacao" sob demanda (idempotente) — mesmo padrão do ContactFill:
// o banco de produção não migra por fora. Só CREATE ... IF NOT EXISTS.
export async function ensureContactValidacaoTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "ContactValidacao" (
      "contactId" TEXT NOT NULL,
      "valor" TEXT NOT NULL,
      "porId" TEXT,
      "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ContactValidacao_pkey" PRIMARY KEY ("contactId")
    );`
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ContactValidacao_porId_idx" ON "ContactValidacao" ("porId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ContactValidacao_em_idx" ON "ContactValidacao" ("em");`);
  ensured = true;
}
