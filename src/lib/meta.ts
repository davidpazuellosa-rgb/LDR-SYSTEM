import { prisma } from "@/lib/prisma";

let ensured = false;

// Cria a tabela "Meta" sob demanda (idempotente). O banco de produção não pode ser
// migrado por fora, então criamos a tabela via SQL na primeira vez que ela é usada.
// Só faz CREATE ... IF NOT EXISTS — nunca altera/derruba nada existente.
export async function ensureMetaTable() {
  if (ensured) return;
  // Tabela nova já nasce no formato atual (2 tipos de meta).
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "Meta" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "tipo" TEXT NOT NULL DEFAULT 'preenchimento',
      "baseId" TEXT,
      "regiao" TEXT,
      "estado" TEXT,
      "campanha" TEXT,
      "prazo" TEXT NOT NULL DEFAULT 'semanal',
      "alvo" INTEGER NOT NULL DEFAULT 0,
      "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Meta_pkey" PRIMARY KEY ("id")
    );`
  );
  // Evolução de tabelas antigas (base+estado, corrigidos/preenchidos) para o novo
  // formato. Só adiciona colunas e afrouxa NOT NULL — nunca derruba dados.
  await prisma.$executeRawUnsafe(`ALTER TABLE "Meta" ADD COLUMN IF NOT EXISTS "tipo" TEXT NOT NULL DEFAULT 'preenchimento';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Meta" ADD COLUMN IF NOT EXISTS "regiao" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Meta" ADD COLUMN IF NOT EXISTS "campanha" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Meta" ADD COLUMN IF NOT EXISTS "prazo" TEXT NOT NULL DEFAULT 'semanal';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Meta" ADD COLUMN IF NOT EXISTS "alvo" INTEGER NOT NULL DEFAULT 0;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Meta" ADD COLUMN IF NOT EXISTS "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
  // Tabela auxiliar: quando cada LDR viu suas metas pela última vez (para "meta nova").
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "MetaVisto" ("userId" TEXT NOT NULL, "vistoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "MetaVisto_pkey" PRIMARY KEY ("userId"));`
  );
  // Snapshots de metas (histórico congelado por período encerrado).
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "MetaSnapshot" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "tipo" TEXT NOT NULL,
      "baseId" TEXT,
      "regiao" TEXT,
      "estado" TEXT,
      "campanha" TEXT,
      "prazo" TEXT NOT NULL,
      "alvo" INTEGER NOT NULL DEFAULT 0,
      "feito" INTEGER NOT NULL DEFAULT 0,
      "periodoInicio" TIMESTAMP(3) NOT NULL,
      "chave" TEXT NOT NULL,
      "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MetaSnapshot_pkey" PRIMARY KEY ("id")
    );`
  );
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MetaSnapshot_chave_key" ON "MetaSnapshot" ("chave");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MetaSnapshot_userId_idx" ON "MetaSnapshot" ("userId");`);
  // Metas de correção não usam base/estado — esses campos passam a ser opcionais.
  await prisma.$executeRawUnsafe(`ALTER TABLE "Meta" ALTER COLUMN "baseId" DROP NOT NULL;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Meta" ALTER COLUMN "estado" DROP NOT NULL;`);
  // O índice único antigo (base+estado) não cabe nos 2 tipos; a API deduplica em código.
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "Meta_userId_baseId_estado_key";`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Meta_userId_idx" ON "Meta" ("userId");`);
  ensured = true;
}
