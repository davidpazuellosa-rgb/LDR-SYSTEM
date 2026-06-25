import { prisma } from "@/lib/prisma";

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
