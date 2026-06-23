// Alinha o status do telefone da base local com a Fase do Ciclo de Vida do HubSpot.
// Telefone Incorreto (1320556150) -> status "telefone_incorreto" (+ fila de correção)
// Telefone Atualizado (1320496031) -> status "telefone_atualizado"
// Cruzamento por cidade + UF. NÃO escreve nada no HubSpot.
// Uso:  node scripts/align-crm-status.js          -> conferência (dry-run)
//       node scripts/align-crm-status.js --apply  -> aplica na base local
const path = require("path");
const fs = require("fs");
const { PrismaClient } = require(path.join(__dirname, "..", "node_modules", "@prisma/client"));
const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const BASE_NAME = "Cidade na mão - Região Nordeste";
const STAGE = { incorreto: "1320556150", atualizado: "1320496031" };

const UF = {
  "alagoas": "AL", "bahia": "BA", "ceara": "CE", "maranhao": "MA", "paraiba": "PB",
  "pernambuco": "PE", "piaui": "PI", "rio grande do norte": "RN", "sergipe": "SE",
};
const SIGLAS = new Set(Object.values(UF));
const norm = (s) => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function token() {
  const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
  const m = env.match(/HUBSPOT_TOKEN="([^"]*)"/);
  return m ? m[1] : "";
}

function parse(p) {
  const nome = ((p.firstname || "") + " " + (p.lastname || "")).trim();
  let uf = "";
  const paren = nome.match(/\(([^)]+)\)/);
  if (paren) uf = UF[norm(paren[1])] || (SIGLAS.has(paren[1].toUpperCase()) ? paren[1].toUpperCase() : "");
  if (!uf) { const sl = nome.match(/\/\s*([A-Za-z]{2})\b/); if (sl && SIGLAS.has(sl[1].toUpperCase())) uf = sl[1].toUpperCase(); }
  if (!uf && p.state) uf = UF[norm(p.state)] || (SIGLAS.has((p.state || "").toUpperCase()) ? p.state.toUpperCase() : "");
  let cidade = p.city || "";
  if (!cidade) {
    cidade = nome.replace(/\([^)]*\)/g, "").replace(/\/.*$/, "")
      .replace(/^.*?prefeitura\s+(municipal\s+)?(de|do|da|dos|das)?\s*/i, "").trim();
  }
  return { cidade, uf };
}

async function fetchStage(tk, stageId) {
  const out = [];
  let after;
  do {
    const body = {
      filterGroups: [{ filters: [
        { propertyName: "campanha", operator: "EQ", value: "Cidade Na Mão 2026" },
        { propertyName: "regiao", operator: "EQ", value: "Nordeste" },
        { propertyName: "lifecyclestage", operator: "EQ", value: stageId },
      ] }],
      properties: ["firstname", "lastname", "city", "state"],
      limit: 100,
    };
    if (after) body.after = after;
    const r = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
      method: "POST",
      headers: { Authorization: "Bearer " + tk, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.status === "error") throw new Error(j.message);
    out.push(...(j.results || []));
    after = j.paging && j.paging.next && j.paging.next.after;
  } while (after);
  return out;
}

async function main() {
  const tk = token();
  const base = await prisma.base.findFirst({ where: { name: BASE_NAME } });
  if (!base) throw new Error("Base local não encontrada");

  const locais = await prisma.contact.findMany({ where: { baseId: base.id }, select: { id: true, cidade: true, estado: true } });
  const byKey = new Map();        // "cidade|uf" -> id
  const byCity = new Map();       // "cidade" -> [ids]
  for (const c of locais) {
    const k = norm(c.cidade) + "|" + norm(c.estado);
    if (norm(c.cidade)) { byKey.set(k, c.id); byCity.set(norm(c.cidade), [...(byCity.get(norm(c.cidade)) || []), c.id]); }
  }

  function matchId(cidade, uf) {
    const k = norm(cidade) + "|" + norm(uf);
    if (byKey.has(k)) return byKey.get(k);
    const arr = byCity.get(norm(cidade));
    if (arr && arr.length === 1) return arr[0]; // cidade única -> aceita mesmo sem UF
    return null;
  }

  const [incorretos, atualizados] = await Promise.all([fetchStage(tk, STAGE.incorreto), fetchStage(tk, STAGE.atualizado)]);

  const resolve = (list) => {
    const ids = new Set(); let semMatch = 0;
    for (const c of list) { const { cidade, uf } = parse(c.properties); const id = matchId(cidade, uf); if (id) ids.add(id); else semMatch++; }
    return { ids, semMatch };
  };
  const A = resolve(atualizados);
  const I = resolve(incorretos);
  // Incorreto tem prioridade: remove dos atualizados quem também é incorreto
  for (const id of I.ids) A.ids.delete(id);

  console.log("=== CONFERÊNCIA (cruzamento por cidade+UF) ===");
  console.log(`HubSpot Telefone Incorreto: ${incorretos.length}  -> casaram na base: ${I.ids.size}  (sem match: ${I.semMatch})`);
  console.log(`HubSpot Telefone Atualizado: ${atualizados.length} -> casaram na base: ${A.ids.size}  (sem match: ${A.semMatch})`);

  if (!APPLY) { console.log("\n(dry-run) Rode com --apply para gravar."); await prisma.$disconnect(); return; }

  const admin = await prisma.user.findFirst({ where: { role: "admin" } });
  // 1) zera tudo
  await prisma.correction.deleteMany({ where: { contact: { baseId: base.id } } });
  await prisma.contact.updateMany({ where: { baseId: base.id }, data: { status: "ok" } });
  // 2) atualizados
  if (A.ids.size) await prisma.contact.updateMany({ where: { id: { in: [...A.ids] } }, data: { status: "telefone_atualizado" } });
  // 3) incorretos
  if (I.ids.size) {
    await prisma.contact.updateMany({ where: { id: { in: [...I.ids] } }, data: { status: "telefone_incorreto" } });
    const recs = await prisma.contact.findMany({ where: { id: { in: [...I.ids] } }, select: { id: true, telefonePrefeitura: true } });
    await prisma.correction.createMany({
      data: recs.map((c) => ({ contactId: c.id, field: "telefonePrefeitura", oldValue: c.telefonePrefeitura,
        reason: "Telefone Incorreto (Fase do Ciclo de Vida no HubSpot)", status: "pending", createdById: admin ? admin.id : null })),
    });
  }
  console.log(`\n✅ Aplicado: ${I.ids.size} marcados como "Telefone Incorreto" (+ fila), ${A.ids.size} como "Telefone Atualizado".`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
