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

export type CustomCol = { key: string; label: string };

// Lê/normaliza as definições de colunas personalizadas guardadas em Base.headers.__cols__.
export function parseCustomCols(headers: Record<string, unknown> | null | undefined): CustomCol[] {
  const raw = (headers || {})["__cols__"];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({ key: String(c.key || ""), label: String(c.label || "").slice(0, 60) }))
    .filter((c) => c.key && c.label)
    .slice(0, 30);
}
