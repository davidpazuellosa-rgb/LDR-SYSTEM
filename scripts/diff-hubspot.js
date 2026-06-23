// Conferência (e opcionalmente inserção) das prefeituras que estão no HubSpot
// (campanha "Cidade Na Mão 2026" + região Nordeste) e NÃO estão na base local.
// Uso:  node scripts/diff-hubspot.js          -> só mostra (dry-run)
//       node scripts/diff-hubspot.js --apply  -> insere as faltantes na base local
const path = require("path");
const fs = require("fs");
const { PrismaClient } = require(path.join(__dirname, "..", "node_modules", "@prisma/client"));
const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const BASE_NAME = "Cidade na mão - Região Nordeste";

const UF = {
  "alagoas": "AL", "bahia": "BA", "ceara": "CE", "maranhao": "MA", "paraiba": "PB",
  "pernambuco": "PE", "piaui": "PI", "rio grande do norte": "RN", "sergipe": "SE",
};
const norm = (s) => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function token() {
  const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
  const m = env.match(/HUBSPOT_TOKEN="([^"]*)"/);
  return m ? m[1] : "";
}

function parseFromName(name) {
  // "Prefeitura de Xique-Xique (Bahia)" -> { cidade:"Xique-Xique", uf:"BA" }
  let cidade = "", uf = "";
  const paren = name.match(/\(([^)]+)\)/);
  if (paren) uf = UF[norm(paren[1])] || "";
  let base = name.replace(/\([^)]*\)/g, "").trim();
  base = base.replace(/^prefeitura\s+(municipal\s+)?(de|do|da|dos|das)\s+/i, "").trim();
  cidade = base;
  return { cidade, uf };
}

async function fetchAllPrefeituras(tk) {
  const out = [];
  let after;
  do {
    const body = {
      filterGroups: [{ filters: [
        { propertyName: "campanha", operator: "EQ", value: "Cidade Na Mão 2026" },
        { propertyName: "regiao", operator: "EQ", value: "Nordeste" },
      ] }],
      properties: ["email", "firstname", "lastname", "phone", "city", "state", "website", "whatsapp_telefone_principal"],
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

  const locais = await prisma.contact.findMany({
    where: { baseId: base.id },
    select: { emailInstitucional: true, cidade: true, estado: true },
  });
  const emailsLocais = new Set(locais.map((c) => norm(c.emailInstitucional)).filter(Boolean));
  const chaveCidade = new Set(locais.map((c) => norm(c.cidade) + "|" + norm(c.estado)).filter((k) => k !== "|"));

  const hub = await fetchAllPrefeituras(tk);
  const prefs = hub.filter((c) => norm((c.properties.firstname || "") + (c.properties.lastname || "")).includes("prefeitura"));

  const faltantes = [];
  for (const c of prefs) {
    const p = c.properties;
    const email = norm(p.email);
    const parsed = parseFromName((p.firstname || "") + " " + (p.lastname || ""));
    const cidade = p.city || parsed.cidade;
    const uf = parsed.uf || "";
    const chave = norm(cidade) + "|" + norm(uf);
    const existe = (email && emailsLocais.has(email)) || (chave !== "|" && chaveCidade.has(chave));
    if (!existe) faltantes.push({ cidade, uf, email: p.email || "", phone: p.phone || "", website: p.website || "", whats: p.whatsapp_telefone_principal || "" });
  }

  console.log(`HubSpot prefeituras: ${prefs.length} | base local: ${locais.length}`);
  console.log(`FALTANTES (no HubSpot e não na base local): ${faltantes.length}\n`);
  faltantes.forEach((f, i) => console.log(`${i + 1}. ${f.cidade}/${f.uf}  | ${f.email || "(sem email)"} | tel: ${f.phone || "-"}`));

  if (APPLY && faltantes.length) {
    const validPhone = (v) => { const d = (v || "").replace(/\D/g, ""); return d.length >= 10 && d.length <= 13; };
    const admin = await prisma.user.findFirst({ where: { role: "admin" } });
    const created = [];
    for (const f of faltantes) {
      const c = await prisma.contact.create({
        data: {
          baseId: base.id,
          cidade: f.cidade || null,
          estado: f.uf || null,
          regiao: "Nordeste",
          telefonePrefeitura: f.phone || null,
          emailInstitucional: f.email || null,
          siteOficial: f.website || null,
          whatsapp: f.whats || null,
          campanha: "Cidade na Mão 2026",
          solucaoInteresse: "Cidade na mão",
          origemContato: "HubSpot CRM (conferência)",
          status: validPhone(f.phone) ? "ok" : "phone_invalid",
        },
      });
      created.push(c);
      if (c.status === "phone_invalid") {
        await prisma.correction.create({
          data: { contactId: c.id, field: "telefonePrefeitura", oldValue: c.telefonePrefeitura,
            reason: "Telefone ausente/inválido (vindo do HubSpot)", status: "pending", createdById: admin ? admin.id : null },
        });
      }
    }
    console.log(`\n✅ Inseridas ${created.length} prefeituras na base local.`);
  }

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
