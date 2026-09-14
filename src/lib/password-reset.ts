// Recuperação de senha ("esqueci minha senha").
//
// POR QUE NÃO REAPROVEITAR O CONVITE (src/lib/invite.ts):
// o convite guarda o token como sentinela DENTRO de `User.passwordHash`, apagando a
// senha atual. Isso é aceitável num convite (a pessoa ainda não tem senha), mas seria
// uma falha grave aqui: como o "esqueci minha senha" é público, qualquer pessoa poderia
// digitar o e-mail de um colega e TRANCÁ-LO PARA FORA do sistema — sem nunca ter acesso
// ao e-mail dele. Por isso o token de recuperação mora em tabela própria e a senha atual
// só é trocada quando o link é realmente usado.
//
// A tabela nasce via SQL idempotente (mesmo padrão de ContactFill/Meta): o banco de
// produção não é migrado por fora.
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

// Janela curta de propósito: um link de recuperação é mais sensível que um convite.
const TTL_MS = 60 * 60 * 1000; // 1 hora
// Evita que apertar o botão várias vezes dispare uma enxurrada de e-mails.
const REENVIO_MS = 60 * 1000; // 1 minuto

let ensured = false;

export async function ensurePasswordResetTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "PasswordReset" (
      "tokenHash" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "usedAt" TIMESTAMP(3),
      "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("tokenHash")
    );`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PasswordReset_userId_idx" ON "PasswordReset" ("userId");`
  );
  ensured = true;
}

const hashOf = (secret: string) => crypto.createHash("sha256").update(secret).digest("hex");

type ResetRow = { tokenHash: string; userId: string; expiresAt: Date; usedAt: Date | null; criadoEm: Date };

/**
 * Cria um link de recuperação. O segredo bruto vai só no e-mail; no banco fica o hash,
 * então vazar o banco não dá a ninguém um link utilizável.
 * Devolve `null` se um link já foi pedido há menos de 1 minuto (anti-flood).
 */
export async function criarTokenDeRecuperacao(userId: string): Promise<string | null> {
  await ensurePasswordResetTable();

  const recentes = await prisma.$queryRawUnsafe<ResetRow[]>(
    `SELECT * FROM "PasswordReset" WHERE "userId" = $1 AND "criadoEm" > $2 LIMIT 1`,
    userId,
    new Date(Date.now() - REENVIO_MS)
  );
  if (recentes.length > 0) return null;

  // Um pedido novo invalida os anteriores — só o último link vale.
  await prisma.$executeRawUnsafe(`DELETE FROM "PasswordReset" WHERE "userId" = $1`, userId);

  const secret = crypto.randomBytes(32).toString("base64url");
  await prisma.$executeRawUnsafe(
    `INSERT INTO "PasswordReset" ("tokenHash", "userId", "expiresAt") VALUES ($1, $2, $3)`,
    hashOf(secret),
    userId,
    new Date(Date.now() + TTL_MS)
  );

  return Buffer.from(`${userId}:${secret}`).toString("base64url");
}

function parse(token: string): { userId: string; secret: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const i = decoded.indexOf(":");
    if (i <= 0) return null;
    return { userId: decoded.slice(0, i), secret: decoded.slice(i + 1) };
  } catch {
    return null;
  }
}

type Check = { ok: true; userId: string } | { ok: false; reason: string };

const EXPIRADO = "Este link expirou ou já foi usado. Peça um novo em \"Esqueci minha senha\".";

/** Confere o token SEM consumir — usado pela página, só para decidir o que mostrar. */
export async function verificarTokenDeRecuperacao(token: string): Promise<Check> {
  const parsed = parse(token);
  if (!parsed) return { ok: false, reason: "Link inválido." };
  await ensurePasswordResetTable();

  const rows = await prisma.$queryRawUnsafe<ResetRow[]>(
    `SELECT * FROM "PasswordReset" WHERE "tokenHash" = $1 LIMIT 1`,
    hashOf(parsed.secret)
  );
  const row = rows[0];
  if (!row || row.userId !== parsed.userId) return { ok: false, reason: "Link inválido." };
  if (row.usedAt) return { ok: false, reason: EXPIRADO };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: EXPIRADO };
  return { ok: true, userId: row.userId };
}

/**
 * Confere e CONSUMA o token — chamado na hora de gravar a senha nova.
 * A marcação de uso é condicional (`usedAt IS NULL`), então dois envios simultâneos
 * do mesmo link não trocam a senha duas vezes.
 */
export async function consumirTokenDeRecuperacao(token: string): Promise<Check> {
  const check = await verificarTokenDeRecuperacao(token);
  if (!check.ok) return check;

  const parsed = parse(token)!;
  const marcados = await prisma.$executeRawUnsafe(
    `UPDATE "PasswordReset" SET "usedAt" = NOW() WHERE "tokenHash" = $1 AND "usedAt" IS NULL`,
    hashOf(parsed.secret)
  );
  if (marcados === 0) return { ok: false, reason: EXPIRADO };
  return check;
}
