import { prisma } from "@/lib/prisma";

// Vínculo usuário (Pré-vendedor) ↔ "Proprietário" do HubSpot (nome do dono nos
// contatos). Guardado numa tabela própria criada sob demanda (padrão Meta/Sugestão),
// pra NÃO mexer no modelo User nem no banco de produção por fora.
let ensured = false;
export async function ensureUserProprietarioTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "UserProprietario" (
      "userId" TEXT NOT NULL,
      "proprietario" TEXT NOT NULL,
      CONSTRAINT "UserProprietario_pkey" PRIMARY KEY ("userId")
    );`
  );
  ensured = true;
}

// Proprietário vinculado a um usuário (null = sem vínculo).
export async function getProprietarioDoUsuario(userId: string): Promise<string | null> {
  if (!userId) return null;
  await ensureUserProprietarioTable();
  const rows = await prisma.$queryRawUnsafe<{ proprietario: string }[]>(
    `SELECT "proprietario" FROM "UserProprietario" WHERE "userId" = $1 LIMIT 1`,
    userId
  );
  return rows[0]?.proprietario?.trim() || null;
}

// Mapa userId -> proprietário, para a tela de Usuários.
export async function getMapaProprietarios(): Promise<Record<string, string>> {
  await ensureUserProprietarioTable();
  const rows = await prisma.$queryRawUnsafe<{ userId: string; proprietario: string }[]>(
    `SELECT "userId", "proprietario" FROM "UserProprietario"`
  );
  return Object.fromEntries(rows.map((r) => [r.userId, r.proprietario]));
}

// Define (ou remove, se vazio) o proprietário de um usuário.
export async function setProprietarioDoUsuario(userId: string, proprietario: string | null | undefined) {
  if (!userId) return;
  await ensureUserProprietarioTable();
  const p = (proprietario || "").trim();
  if (!p) {
    await prisma.$executeRawUnsafe(`DELETE FROM "UserProprietario" WHERE "userId" = $1`, userId);
    return;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "UserProprietario" ("userId", "proprietario") VALUES ($1, $2)
     ON CONFLICT ("userId") DO UPDATE SET "proprietario" = EXCLUDED."proprietario"`,
    userId,
    p
  );
}

// Lista os "Proprietários" distintos existentes nos contatos (para o dropdown do admin).
export async function listarProprietarios(): Promise<string[]> {
  const rows = await prisma.contact.findMany({
    where: { proprietario: { not: null }, deletedAt: null },
    select: { proprietario: true },
    distinct: ["proprietario"],
    orderBy: { proprietario: "asc" },
  });
  return rows.map((r) => r.proprietario).filter((p): p is string => !!p && p.trim().length > 0);
}
