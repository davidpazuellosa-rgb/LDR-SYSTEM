import { prisma } from "@/lib/prisma";

let ensured = false;

// Cria a tabela "ContactCustomValue" sob demanda (idempotente) — guarda os valores
// das colunas personalizadas sem alterar a tabela Contact (produção sem migration).
export async function ensureContactCustomTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "ContactCustomValue" (
      "contactId" TEXT NOT NULL,
      "colKey" TEXT NOT NULL,
      "valor" TEXT,
      CONSTRAINT "ContactCustomValue_pkey" PRIMARY KEY ("contactId", "colKey")
    );`
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ContactCustomValue_contactId_idx" ON "ContactCustomValue" ("contactId");`);
  // Usado por "reprocessar conclusão" e afins ao filtrar por coluna (colKey) sozinha.
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ContactCustomValue_colKey_idx" ON "ContactCustomValue" ("colKey");`);
  ensured = true;
}

// parseCustomCols/CustomCol moraram aqui, mas este arquivo importa o prisma e a
// planilha (client component) precisa deles: ficaram em base-columns.ts, que é
// puro. Reexportados para não quebrar quem já importava daqui.
export { parseCustomCols, type CustomCol } from "@/lib/base-columns";
