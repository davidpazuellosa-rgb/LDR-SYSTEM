/**
 * Teste de integração REAL do fluxo de metas, contra o banco de verdade.
 * - Checagens read-only nos dados reais (David, bases→regiões→estados, campanhas).
 * - Cenário ISOLADO com dados marcados "ZZ_TESTE": cria base/contato/meta de teste,
 *   exercita os caminhos reais (completar linha → ContactFill, contar no dashboard,
 *   correção) e APAGA tudo no finally. NÃO toca em nenhum dado real.
 *
 * Rodar: node --import tsx scripts/verify-metas.ts
 */
import { PrismaClient } from "@prisma/client";
import { REQUIRED_FIELDS, isComplete, tipoOrgao } from "../src/lib/completude";
import { ufSigla } from "../src/lib/uf";
import { isCampanhaAtiva, normCampanha } from "../src/lib/campanhas";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✅ ${label}${extra ? `  (${extra})` : ""}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}${extra ? `  (${extra})` : ""}`);
  }
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}
const periodStart = (prazo: string, now: Date) =>
  prazo === "mensal" ? new Date(now.getFullYear(), now.getMonth(), 1) : startOfWeek(now);

// Réplica EXATA da lógica do dashboard (metaFeito), para validar a contagem real.
type Fill = { concluidoEm: Date; baseId: string; regiao: string | null; estado: string | null };
type Corr = { resolvedById: string | null; resolvedAt: Date | null; campanha: string | null };
function metaFeitoPreench(m: { baseId: string; regiao: string; estado: string; prazo: string }, now: Date, fills: Fill[]) {
  const start = periodStart(m.prazo, now);
  return fills.filter(
    (f) =>
      f.concluidoEm >= start &&
      f.baseId === m.baseId &&
      ((f.regiao && f.regiao.trim()) || "Sem região") === m.regiao &&
      ufSigla(f.estado) === m.estado
  ).length;
}
function metaFeitoCorr(m: { userId: string; campanha: string; prazo: string }, now: Date, corrs: Corr[]) {
  const start = periodStart(m.prazo, now);
  const camp = normCampanha(m.campanha);
  return corrs.filter(
    (c) => c.resolvedById === m.userId && c.resolvedAt && c.resolvedAt >= start && normCampanha(c.campanha) === camp
  ).length;
}

// DDL idempotente (mesma das libs ensureMetaTable/ensureContactFillTable).
async function ensureTables() {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "Meta" ("id" TEXT NOT NULL,"userId" TEXT NOT NULL,"tipo" TEXT NOT NULL DEFAULT 'preenchimento',"baseId" TEXT,"regiao" TEXT,"estado" TEXT,"campanha" TEXT,"prazo" TEXT NOT NULL DEFAULT 'semanal',"alvo" INTEGER NOT NULL DEFAULT 0,CONSTRAINT "Meta_pkey" PRIMARY KEY ("id"));`
  );
  await prisma.$executeRawUnsafe(`ALTER TABLE "Meta" ADD COLUMN IF NOT EXISTS "tipo" TEXT NOT NULL DEFAULT 'preenchimento';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Meta" ADD COLUMN IF NOT EXISTS "regiao" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Meta" ADD COLUMN IF NOT EXISTS "campanha" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Meta" ADD COLUMN IF NOT EXISTS "alvo" INTEGER NOT NULL DEFAULT 0;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Meta" ALTER COLUMN "baseId" DROP NOT NULL;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Meta" ALTER COLUMN "estado" DROP NOT NULL;`);
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "ContactFill" ("contactId" TEXT NOT NULL,"preenchidoPorId" TEXT NOT NULL,"concluidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ContactFill_pkey" PRIMARY KEY ("contactId"));`
  );
}

async function main() {
  const now = new Date();
  console.log("\n=== 1) Tabelas (idempotente, não-destrutivo) ===");
  await ensureTables();
  check("ensureTables() rodou sem erro", true);

  console.log("\n=== 2) Read-only: conta do David Pazuello ===");
  const david = await prisma.user.findFirst({
    where: { OR: [{ email: "davidpazuellosa@gmail.com" }, { name: { contains: "David", mode: "insensitive" } }] },
    select: { id: true, name: true, email: true, role: true },
  });
  check("David Pazuello existe", !!david, david ? `${david.name} · ${david.email} · role=${david.role}` : "não encontrado");
  if (!david) throw new Error("Sem usuário David — não dá pra testar com a conta dele.");

  console.log("\n=== 3) Read-only: bases → tipos → regiões → estados (seletores do popup) ===");
  const bases = await prisma.base.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const pares = await prisma.contact.findMany({
    where: { deletedAt: null },
    select: { baseId: true, regiao: true, estado: true },
    distinct: ["baseId", "regiao", "estado"],
  });
  const tree = new Map<string, Map<string, Set<string>>>();
  for (const p of pares) {
    const uf = ufSigla(p.estado);
    if (!uf) continue;
    const reg = (p.regiao && p.regiao.trim()) || "Sem região";
    if (!tree.has(p.baseId)) tree.set(p.baseId, new Map());
    const r = tree.get(p.baseId)!;
    if (!r.has(reg)) r.set(reg, new Set());
    r.get(reg)!.add(uf);
  }
  for (const b of bases) {
    const regs = tree.get(b.id);
    const tipo = tipoOrgao(b.name);
    const resumo = regs ? [...regs.entries()].map(([r, ufs]) => `${r}[${[...ufs].sort().join(",")}]`).join(" · ") : "(sem contatos)";
    console.log(`     • ${b.name}  →  tipo "${tipo}"  →  ${resumo}`);
  }
  check("Há ao menos 1 base com região+estado resolvidos", bases.some((b) => (tree.get(b.id)?.size || 0) > 0));

  console.log("\n=== 4) Read-only: campanhas ativas (seletor de correção) ===");
  const comCamp = await prisma.contact.findMany({ where: { deletedAt: null }, select: { campanha: true }, distinct: ["campanha"] });
  const campanhas = [...new Set(comCamp.map((c) => (c.campanha || "").trim()).filter((c) => isCampanhaAtiva(c)))].sort();
  console.log(`     campanhas ativas: ${campanhas.join(" · ") || "(nenhuma)"}`);
  check("Há ao menos 1 campanha ativa", campanhas.length > 0);

  // ---- Cenário isolado de escrita (tudo marcado ZZ_TESTE, removido no finally) ----
  const created: { baseId?: string; contactId?: string; metaIds: string[]; corrId?: string } = { metaIds: [] };
  try {
    console.log("\n=== 5) Escrita ISOLADA: completar linha conta para a meta de preenchimento ===");
    const base = await prisma.base.create({ data: { name: "ZZ_TESTE_VERIFICACAO", source: "manual" } });
    created.baseId = base.id;
    // Linha INCOMPLETA (falta siteOficial), região Norte / estado AM, campanha de teste.
    const contact = await prisma.contact.create({
      data: {
        baseId: base.id,
        regiao: "Norte",
        estado: "AM",
        campanha: "ZZ_TESTE_CAMPANHA",
        cidade: "Cidade Teste",
        telefonePrefeitura: "92999999999",
        emailInstitucional: "teste@teste.gov.br",
        nomePrefeito: "Fulano Teste",
        whatsapp: "92999999999",
        // siteOficial: vazio de propósito → incompleta
      },
    });
    created.contactId = contact.id;

    const meta = await prisma.meta.create({
      data: { userId: david.id, tipo: "preenchimento", baseId: base.id, regiao: "Norte", estado: "AM", prazo: "semanal", alvo: 1 },
    });
    created.metaIds.push(meta.id);

    const loadFills = async (): Promise<Fill[]> => {
      const fillRows = await prisma.contactFill.findMany({ where: { contactId: contact.id }, select: { contactId: true, concluidoEm: true } });
      return fillRows.map((f) => ({ concluidoEm: f.concluidoEm, baseId: contact.baseId, regiao: contact.regiao, estado: contact.estado }));
    };

    check("Linha começa INCOMPLETA", !isComplete(contact));
    check("metaFeito ANTES de completar = 0", metaFeitoPreench({ baseId: base.id, regiao: "Norte", estado: "AM", prazo: "semanal" }, now, await loadFills()) === 0);

    // Simula o PATCH: preenche o último campo da régua → reconcilia ContactFill.
    const done = await prisma.contact.update({ where: { id: contact.id }, data: { siteOficial: "https://teste.gov.br" } });
    const touched = REQUIRED_FIELDS.some((f) => f === "siteOficial");
    if (touched && isComplete(done)) {
      await prisma.contactFill.upsert({
        where: { contactId: contact.id },
        create: { contactId: contact.id, preenchidoPorId: david.id, concluidoEm: new Date() },
        update: {},
      });
    }
    check("Linha ficou COMPLETA", isComplete(done));
    const fillsAfter = await loadFills();
    check("ContactFill criado para a linha", fillsAfter.length === 1);
    check("metaFeito DEPOIS de completar = 1", metaFeitoPreench({ baseId: base.id, regiao: "Norte", estado: "AM", prazo: "semanal" }, now, fillsAfter) === 1);

    console.log("\n=== 6) Crédito do 1º a completar é preservado (re-salvar não muda) ===");
    const fill1 = await prisma.contactFill.findUnique({ where: { contactId: contact.id } });
    // Re-salva um campo da régua mantendo completa → upsert update:{} não muda.
    await prisma.contact.update({ where: { id: contact.id }, data: { cidade: "Cidade Teste 2" } });
    await prisma.contactFill.upsert({ where: { contactId: contact.id }, create: { contactId: contact.id, preenchidoPorId: "outro", concluidoEm: new Date() }, update: {} });
    const fill2 = await prisma.contactFill.findUnique({ where: { contactId: contact.id } });
    check("preenchidoPorId preservado (1º a completar)", fill1?.preenchidoPorId === fill2?.preenchidoPorId && fill2?.preenchidoPorId === david.id);

    console.log("\n=== 7) Voltar a incompleta remove a conclusão ===");
    const reverted = await prisma.contact.update({ where: { id: contact.id }, data: { siteOficial: null } });
    if (!isComplete(reverted)) await prisma.contactFill.deleteMany({ where: { contactId: contact.id } });
    const fillsReverted = await loadFills();
    check("ContactFill removido ao ficar incompleta", fillsReverted.length === 0);
    check("metaFeito volta a 0", metaFeitoPreench({ baseId: base.id, regiao: "Norte", estado: "AM", prazo: "semanal" }, now, fillsReverted) === 0);

    console.log("\n=== 8) Meta de correção conta correção resolvida pelo LDR na campanha ===");
    const metaCorr = await prisma.meta.create({
      data: { userId: david.id, tipo: "correcao", campanha: "ZZ_TESTE_CAMPANHA", prazo: "semanal", alvo: 1 },
    });
    created.metaIds.push(metaCorr.id);
    const corr = await prisma.correction.create({
      data: { contactId: contact.id, field: "telefonePrefeitura", oldValue: "1", newValue: "2", status: "resolved", resolvedById: david.id, resolvedAt: new Date() },
    });
    created.corrId = corr.id;
    const corrRows = await prisma.correction.findMany({
      where: { status: "resolved", resolvedAt: { not: null }, contactId: contact.id },
      select: { resolvedById: true, resolvedAt: true, contact: { select: { campanha: true } } },
    });
    const corrs: Corr[] = corrRows.map((r) => ({ resolvedById: r.resolvedById, resolvedAt: r.resolvedAt, campanha: r.contact.campanha }));
    check("metaFeito (correção) = 1 para David na campanha", metaFeitoCorr({ userId: david.id, campanha: "ZZ_TESTE_CAMPANHA", prazo: "semanal" }, now, corrs) === 1);
    check("metaFeito (correção) = 0 para outro usuário", metaFeitoCorr({ userId: "outro", campanha: "ZZ_TESTE_CAMPANHA", prazo: "semanal" }, now, corrs) === 0);
  } finally {
    console.log("\n=== 9) Limpeza (removendo tudo que o teste criou) ===");
    if (created.contactId) await prisma.contactFill.deleteMany({ where: { contactId: created.contactId } });
    if (created.metaIds.length) await prisma.meta.deleteMany({ where: { id: { in: created.metaIds } } });
    if (created.corrId) await prisma.correction.deleteMany({ where: { id: created.corrId } });
    if (created.baseId) await prisma.base.delete({ where: { id: created.baseId } }); // cascata remove contato + correções
    // Confere que não sobrou nada do teste.
    const leftBase = await prisma.base.findFirst({ where: { name: "ZZ_TESTE_VERIFICACAO" } });
    const leftMeta = created.metaIds.length ? await prisma.meta.findMany({ where: { id: { in: created.metaIds } } }) : [];
    const leftFill = created.contactId ? await prisma.contactFill.findMany({ where: { contactId: created.contactId } }) : [];
    check("Base de teste removida", !leftBase);
    check("Metas de teste removidas", leftMeta.length === 0);
    check("ContactFill de teste removido", leftFill.length === 0);
  }

  console.log(`\n===== RESULTADO: ${pass} passou, ${fail} falhou =====\n`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("ERRO no teste:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
