// Traz o "Proprietário do contato" do HubSpot (hubspot_owner_id -> nome) para a
// coluna "proprietario" da base local. Cruzamento por cidade + UF. Read-only no HubSpot.
// Uso:  node scripts/enrich-owner.js          -> conferência (dry-run)
//       node scripts/enrich-owner.js --apply  -> grava na base local
const path = require("path");
const fs = require("fs");
const { PrismaClient } = require(path.join(__dirname, "..", "node_modules", "@prisma/client"));
const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const BASE_NAME = "Cidade na mão - Região Nordeste";

const UF = { "alagoas": "AL", "bahia": "BA", "ceara": "CE", "maranhao": "MA", "paraiba": "PB",
  "pernambuco": "PE", "piaui": "PI", "rio grande do norte": "RN", "sergipe": "SE" };
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
  if (!cidade) cidade = nome.replace(/\([^)]*\)/g, "").replace(/\/.*$/, "").replace(/^.*?prefeitura\s+(municipal\s+)?(de|do|da|dos|das)?\s*/i, "").trim();
  return { cidade, uf };
}

async function owners(tk) {
  const map = new Map();
  let after;
  do {
    const url = new URL("https://api.hubapi.com/crm/v3/owners");
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);
    const r = await fetch(url, { headers: { Authorization: "Bearer " + tk } });
    const j = await r.json();
    if (j.status === "error") throw new Error(j.message);
    for (const o of j.results || []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ").trim() || o.email || o.id;
      map.set(String(o.id), name);
    }
    after = j.paging && j.paging.next && j.paging.next.after;
  } while (after);
  return map;
}

async function fetchPrefeituras(tk) {
  const out = [];
  let after;
  do {
    const body = {
      filterGroups: [{ filters: [
        { propertyName: "campanha", operator: "EQ", value: "Cidade Na Mão 2026" },
        { propertyName: "regiao", operator: "EQ", value: "Nordeste" },
      ] }],
      properties: ["firstname", "lastname", "city", "state", "hubspot_owner_id"],
      limit: 100,
    };
    if (after) body.after = after;
    const r = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
      method: "POST", headers: { Authorization: "Bearer " + tk, "Content-Type": "application/json" }, body: JSON.stringify(body),
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
  const locais = await prisma.contact.findMany({ where: { baseId: base.id }, select: { id: true, cidade: true, estado: true } });
  const byKey = new Map(); const byCity = new Map();
  for (const c of locais) {
    const k = norm(c.cidade) + "|" + norm(c.estado);
    if (norm(c.cidade)) { byKey.set(k, c.id); byCity.set(norm(c.cidade), [...(byCity.get(norm(c.cidade)) || []), c.id]); }
  }
  const matchId = (cidade, uf) => {
    const k = norm(cidade) + "|" + norm(uf);
    if (byKey.has(k)) return byKey.get(k);
    const a = byCity.get(norm(cidade)); return a && a.length === 1 ? a[0] : null;
  };

  const ownerMap = await owners(tk);
  const prefs = (await fetchPrefeituras(tk)).filter((c) => norm((c.properties.firstname || "") + (c.properties.lastname || "")).includes("prefeitura"));

  const dist = new Map(); const updates = [];
  for (const c of prefs) {
    const ownerName = ownerMap.get(String(c.properties.hubspot_owner_id || "")) || "(sem proprietário)";
    const { cidade, uf } = parse(c.properties);
    const id = matchId(cidade, uf);
    if (!id) continue;
    dist.set(ownerName, (dist.get(ownerName) || 0) + 1);
    updates.push({ id, ownerName });
  }

  console.log("=== Proprietários do contato (casaram na base) ===");
  [...dist.entries()].sort((a, b) => b[1] - a[1]).forEach(([n, q]) => console.log(`${q}\t${n}`));
  console.log("Total casado:", updates.length);

  if (APPLY) {
    for (const u of updates) await prisma.contact.update({ where: { id: u.id }, data: { proprietario: u.ownerName } });
    console.log(`\n✅ Atualizado proprietário em ${updates.length} contatos.`);
  } else {
    console.log("\n(dry-run) rode com --apply para gravar.");
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
