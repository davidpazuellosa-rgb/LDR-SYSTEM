import { prisma } from "@/lib/prisma";

let ensured = false;

// Cria a tabela "Suggestion" sob demanda (idempotente). Igual a Meta/ContactFill:
// o banco de produção não pode ser migrado por fora, então a tabela nasce via SQL na
// primeira vez que é usada. Só CREATE ... IF NOT EXISTS — nunca altera/derruba nada.
export async function ensureSuggestionTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "Suggestion" (
      "id" TEXT NOT NULL,
      "usuarioId" TEXT,
      "usuarioNome" TEXT,
      "texto" TEXT NOT NULL,
      "audio" TEXT,
      "status" TEXT NOT NULL DEFAULT 'nova',
      "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
    );`
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Suggestion_status_idx" ON "Suggestion" ("status");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Suggestion_criadoEm_idx" ON "Suggestion" ("criadoEm");`);
  ensured = true;
}
