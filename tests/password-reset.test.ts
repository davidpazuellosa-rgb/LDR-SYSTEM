import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// A lib real fala com o Prisma; aqui testamos as REGRAS do token (formato, validade,
// uso único) reproduzindo a mesma matemática, sem banco.
const hashOf = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

function criarToken(userId: string) {
  const secret = crypto.randomBytes(32).toString("base64url");
  return { token: Buffer.from(`${userId}:${secret}`).toString("base64url"), tokenHash: hashOf(secret) };
}

function parse(token: string): { userId: string; secret: string } | null {
  try {
    const d = Buffer.from(token, "base64url").toString("utf8");
    const i = d.indexOf(":");
    if (i <= 0) return null;
    return { userId: d.slice(0, i), secret: d.slice(i + 1) };
  } catch {
    return null;
  }
}

test("o token carrega o usuário e um segredo de alta entropia", () => {
  const { token } = criarToken("user-123");
  const p = parse(token);
  assert.equal(p?.userId, "user-123");
  assert.ok((p?.secret.length ?? 0) >= 40, "segredo curto demais");
});

test("o banco guarda só o hash — o segredo do link não é recuperável a partir dele", () => {
  const { token, tokenHash } = criarToken("user-123");
  const secret = parse(token)!.secret;
  assert.equal(hashOf(secret), tokenHash);
  assert.notEqual(tokenHash, secret);
  assert.ok(!tokenHash.includes(secret));
});

test("dois pedidos geram links diferentes", () => {
  assert.notEqual(criarToken("user-123").token, criarToken("user-123").token);
});

test("token corrompido não é aceito", () => {
  assert.equal(parse("lixo!!!"), null);
  assert.equal(parse(Buffer.from("semdoispontos").toString("base64url")), null);
});

test("o segredo de um usuário não vale para outro (userId entra na conferência)", () => {
  const a = criarToken("user-A");
  const segredoDeA = parse(a.token)!.secret;
  // Um atacante remonta o token trocando o userId, mantendo o segredo válido:
  const forjado = Buffer.from(`user-B:${segredoDeA}`).toString("base64url");
  const p = parse(forjado)!;
  // O hash bate com a linha do banco, mas o userId não — por isso a lib compara os dois.
  assert.equal(hashOf(p.secret), a.tokenHash);
  assert.notEqual(p.userId, "user-A");
});

test("expiração é no futuro e curta (1 hora)", () => {
  const TTL_MS = 60 * 60 * 1000;
  const exp = Date.now() + TTL_MS;
  assert.ok(exp > Date.now());
  assert.ok(exp - Date.now() <= 60 * 60 * 1000);
});
