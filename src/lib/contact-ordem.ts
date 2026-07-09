import { prisma } from "@/lib/prisma";

let ensured = false;

// Adiciona a coluna "ordem" na tabela Contact (que já existe em produção) sob
// demanda — mesmo padrão usado em Meta/ContactFill/etc. O banco de produção não
// roda migration por fora, então evoluímos colunas via ALTER ... IF NOT EXISTS,
// idempotente e seguro (nunca derruba dados).
export async function ensureContactOrdemColuna() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "ordem" INTEGER;`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Contact_baseId_ordem_idx" ON "Contact" ("baseId", "ordem");`);
  ensured = true;
}

export type SortBy = { key: string; dir: "asc" | "desc" };

// Lê a ordenação ativa (compartilhada) guardada em Base.headers.__sortBy__.
export function parseSortBy(headers: Record<string, unknown> | null | undefined): SortBy | null {
  const raw = (headers || {})["__sortBy__"] as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object") return null;
  const key = String(raw.key || "");
  if (!key) return null;
  return { key, dir: raw.dir === "desc" ? "desc" : "asc" };
}
