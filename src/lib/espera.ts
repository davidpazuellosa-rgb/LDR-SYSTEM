// Lista de espera de bases: órgãos/bases que ainda vão entrar. Tabela criada sob demanda
// (mesmo padrão das demais, sem migração). "Criar base" transforma o item num órgão de verdade.
import { prisma } from "@/lib/prisma";

let ensured = false;
export async function ensureEsperaTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "BaseEspera" (
      "id" TEXT NOT NULL,
      "nome" TEXT NOT NULL,
      "porId" TEXT,
      "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BaseEspera_pkey" PRIMARY KEY ("id")
    );`
  );
  ensured = true;
}

export type ItemEspera = { id: string; nome: string; em: string };

export async function listarEspera(): Promise<ItemEspera[]> {
  await ensureEsperaTable();
  const rows = await prisma.$queryRawUnsafe<{ id: string; nome: string; em: Date }[]>(
    `SELECT "id", "nome", "em" FROM "BaseEspera" ORDER BY "em" ASC`
  );
  return rows.map((r) => ({ id: r.id, nome: r.nome, em: r.em.toISOString() }));
}

// O nome vira o prefixo "{Órgão} - {Região}" das planilhas: não pode ter " - ".
export function nomeEsperaValido(bruto: unknown): string | null {
  const n = String(bruto ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (!n || n.includes(" - ")) return null;
  return n;
}
