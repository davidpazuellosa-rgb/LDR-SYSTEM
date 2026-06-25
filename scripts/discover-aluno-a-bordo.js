// FASE 0 — Descoberta (SOMENTE LEITURA) do "Aluno a Bordo" no HubSpot.
// Não usa banco de dados e NÃO escreve nada no CRM. Apenas lê e imprime um relatório.
// Uso:  node scripts/discover-aluno-a-bordo.js
const path = require("path");
const fs = require("fs");

function token() {
  const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
  const m = env.match(/HUBSPOT_TOKEN\s*=\s*"?([^"\n\r]+)"?/);
  return m ? m[1].trim() : "";
}
const TK = token();
const H = { Authorization: "Bearer " + TK, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

async function hsGet(p) {
  const r = await fetch("https://api.hubapi.com" + p, { headers: H });
  return r.json();
}
async function hsPost(p, body) {
  const r = await fetch("https://api.hubapi.com" + p, { method: "POST", headers: H, body: JSON.stringify(body) });
  return r.json();
}

function printOptions(opts, filterFn) {
  if (!opts || !opts.length) { console.log("   (sem opções / não é enumeração)"); return []; }
  const visible = opts.filter((o) => !o.hidden);
  const list = filterFn ? visible.filter(filterFn) : visible;
  if (!list.length) { console.log("   (nenhuma opção bate o filtro)"); return visible; }
  for (const o of list) console.log(`   • "${o.label}"  =  ${o.value}`);
  return visible;
}

async function main() {
  if (!TK) throw new Error("HUBSPOT_TOKEN não encontrado no .env");
  console.log(`Token: ${TK.slice(0, 8)}…(${TK.length} chars)\n`);

  // 1) Schema: propriedades de contato relevantes
  console.log("===== 1) PROPRIEDADES DE CONTATO (relevantes) =====");
  const props = await hsGet("/crm/v3/properties/contacts");
  const all = props.results || [];
  const KW = ["campanha", "regiao", "secret", "orgao", "cargo", "prefeitura", "escola", "aluno", "tipo", "whatsapp", "telefone", "phone", "job", "company", "municip", "lifecycle"];
  const relevant = all.filter((p) => KW.some((k) => norm(p.name).includes(norm(k)) || norm(p.label).includes(norm(k))));
  for (const p of relevant) console.log(`- ${p.name}  [${p.type}/${p.fieldType}]  "${p.label}"`);

  // 2) campanha — opções com "Aluno"
  console.log("\n===== 2) PROPRIEDADE 'campanha' — opções com 'Aluno' =====");
  const campanhaProp = all.find((p) => p.name === "campanha");
  let alunoCampaigns = [];
  if (campanhaProp) {
    console.log(`tipo: ${campanhaProp.type}/${campanhaProp.fieldType}`);
    const visible = printOptions(campanhaProp.options, (o) => norm(o.label).includes("aluno") || norm(o.value).includes("aluno"));
    alunoCampaigns = (visible || []).filter((o) => norm(o.label).includes("aluno") || norm(o.value).includes("aluno")).map((o) => o.value);
  } else console.log("propriedade 'campanha' não encontrada");

  // 3) regiao — opções
  console.log("\n===== 3) PROPRIEDADE 'regiao' — opções =====");
  const regiaoProp = all.find((p) => p.name === "regiao");
  if (regiaoProp) { console.log(`tipo: ${regiaoProp.type}/${regiaoProp.fieldType}`); printOptions(regiaoProp.options); }
  else console.log("propriedade 'regiao' não encontrada");

  // 4) lifecyclestage — stages (confirma Telefone Incorreto/Atualizado)
  console.log("\n===== 4) LIFECYCLE STAGES =====");
  const lc = await hsGet("/crm/v3/properties/contacts/lifecyclestage");
  printOptions(lc.options);

  // Filtro base para "Aluno a Bordo": IN nas campanhas-enum, ou CONTAINS_TOKEN se texto livre
  const campFilter = alunoCampaigns.length
    ? { propertyName: "campanha", operator: "IN", values: alunoCampaigns }
    : { propertyName: "campanha", operator: "CONTAINS_TOKEN", value: "Aluno a Bordo" };

  // 5) Contagem por campanha + regiões
  console.log("\n===== 5) CONTAGEM por campanha 'Aluno a Bordo' (e regiões) =====");
  if (alunoCampaigns.length) {
    for (const camp of alunoCampaigns) {
      const res = await hsPost("/crm/v3/objects/contacts/search", {
        filterGroups: [{ filters: [{ propertyName: "campanha", operator: "EQ", value: camp }] }],
        properties: ["regiao"],
        limit: 100,
      });
      const regioes = {};
      for (const c of res.results || []) { const r = c.properties.regiao || "(vazio)"; regioes[r] = (regioes[r] || 0) + 1; }
      const regTxt = Object.entries(regioes).map(([r, n]) => `${r}:${n}`).join("  ") || "(sem regiao na amostra)";
      console.log(`▸ "${camp}"  total=${res.total}   | regiões(1ª pág): ${regTxt}`);
      await sleep(300);
    }
  } else {
    const res = await hsPost("/crm/v3/objects/contacts/search", {
      filterGroups: [{ filters: [campFilter] }], properties: ["campanha", "regiao"], limit: 100,
    });
    if (res.status === "error") console.log("ERRO: " + res.message);
    const agg = {};
    for (const c of res.results || []) {
      const k = (c.properties.campanha || "(vazio)") + " || " + (c.properties.regiao || "(vazio)");
      agg[k] = (agg[k] || 0) + 1;
    }
    console.log(`total HubSpot: ${res.total}`);
    for (const [k, n] of Object.entries(agg)) console.log(`  ${k}  → ${n} (na 1ª pág)`);
  }

  // 6) Amostras: secretaria vs pessoa
  console.log("\n===== 6) AMOSTRAS (20) — secretaria vs pessoa =====");
  const sampleProps = ["firstname", "lastname", "email", "phone", "mobilephone", "city", "state", "regiao", "campanha", "lifecyclestage", "jobtitle", "company", "associatedcompanyid"];
  const sample = await hsPost("/crm/v3/objects/contacts/search", {
    filterGroups: [{ filters: [campFilter] }], properties: sampleProps, limit: 20,
  });
  if (sample.status === "error") console.log("ERRO: " + sample.message);
  for (const c of (sample.results || []).slice(0, 20)) {
    const p = c.properties;
    const nome = ((p.firstname || "") + " " + (p.lastname || "")).trim();
    const ehSec = norm(nome).includes("secretaria") || norm(nome).includes("educac");
    const ehPref = norm(nome).includes("prefeitura");
    const tipo = ehSec ? "SECRETARIA?" : ehPref ? "PREFEITURA?" : "PESSOA?";
    console.log(`- [${tipo}] id=${c.id} | nome="${nome}" | empresa="${p.company || "-"}" | cargo="${p.jobtitle || "-"}" | ${p.city || "-"}/${p.state || "-"} | regiao=${p.regiao || "-"} | tel=${p.phone || "-"} mob=${p.mobilephone || "-"} | assocCo=${p.associatedcompanyid || "-"}`);
  }

  // 7) Linkagem contato → empresa (3 amostras)
  console.log("\n===== 7) ASSOCIAÇÃO contato → empresa (3 amostras) =====");
  const ids = (sample.results || []).slice(0, 3).map((c) => c.id);
  for (const id of ids) {
    const a = await hsGet(`/crm/v3/objects/contacts/${id}/associations/companies`);
    const first = a.results && a.results[0];
    const compId = first && (first.id || first.toObjectId);
    if (compId) {
      const comp = await hsGet(`/crm/v3/objects/companies/${compId}?properties=name,city,state`);
      const cp = comp.properties || {};
      console.log(`- contato ${id} → empresa ${compId}: "${cp.name || "-"}" (${cp.city || "-"}/${cp.state || "-"})`);
    } else {
      console.log(`- contato ${id} → (sem empresa associada)`);
    }
    await sleep(250);
  }

  console.log("\n✅ Descoberta concluída (somente leitura — nada foi alterado).");
}
main().catch((e) => { console.error("FALHA:", e); process.exit(1); });
