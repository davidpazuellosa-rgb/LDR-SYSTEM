// FASE 0 (parte 2) — SOMENTE LEITURA. Fecha: tipo_de_entidade (secretaria x pessoa),
// tipo_de_produto, e a contagem completa de "Aluno a Bordo 2026" por região / entidade / stage.
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

async function hsGet(p) { const r = await fetch("https://api.hubapi.com" + p, { headers: H }); return r.json(); }
async function hsPost(p, body) { const r = await fetch("https://api.hubapi.com" + p, { method: "POST", headers: H, body: JSON.stringify(body) }); return r.json(); }
function printOptions(opts) {
  if (!opts || !opts.length) { console.log("   (sem opções)"); return; }
  for (const o of opts.filter((o) => !o.hidden)) console.log(`   • "${o.label}"  =  ${o.value}`);
}
const tally = (map, k) => map.set(k, (map.get(k) || 0) + 1);
const dump = (title, map) => {
  console.log(title);
  const ent = [...map.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, n] of ent) console.log(`     ${k}: ${n}`);
};

const STAGE_LABEL = { "1320556150": "Telefone Incorreto", "1320496031": "Telefone Atualizado" };

async function main() {
  if (!TK) throw new Error("HUBSPOT_TOKEN não encontrado no .env");

  // A) Opções de tipo_de_entidade e tipo_de_produto
  console.log("===== A) tipo_de_entidade — opções =====");
  printOptions((await hsGet("/crm/v3/properties/contacts/tipo_de_entidade")).options);
  console.log("\n===== A) tipo_de_produto — opções =====");
  printOptions((await hsGet("/crm/v3/properties/contacts/tipo_de_produto")).options);

  // B) Varredura completa "Aluno a Bordo 2026"
  console.log("\n===== B) VARREDURA COMPLETA 'Aluno a Bordo 2026' =====");
  const porRegiao = new Map();
  const porEntidade = new Map();
  const porStage = new Map();
  const porProduto = new Map();
  const cross = new Map(); // regiao || entidade
  const samplesByEntidade = new Map(); // entidade -> [amostras]
  const props = ["regiao", "tipo_de_entidade", "tipo_de_produto", "firstname", "lastname", "cargo", "qual_o_cargo", "phone", "mobilephone", "lifecyclestage", "city", "state"];

  let after, total = 0, pages = 0;
  do {
    const body = { filterGroups: [{ filters: [{ propertyName: "campanha", operator: "EQ", value: "Aluno a Bordo 2026" }] }], properties: props, limit: 100 };
    if (after) body.after = after;
    const j = await hsPost("/crm/v3/objects/contacts/search", body);
    if (j.status === "error") { console.log("ERRO: " + j.message); break; }
    total = j.total;
    for (const c of j.results || []) {
      const p = c.properties;
      const reg = p.regiao || "(vazio)";
      const ent = p.tipo_de_entidade || "(vazio)";
      const stg = STAGE_LABEL[p.lifecyclestage] || p.lifecyclestage || "(vazio)";
      tally(porRegiao, reg);
      tally(porEntidade, ent);
      tally(porStage, stg);
      tally(porProduto, p.tipo_de_produto || "(vazio)");
      tally(cross, reg + "  ||  " + ent);
      const arr = samplesByEntidade.get(ent) || [];
      if (arr.length < 3) {
        arr.push(`"${((p.firstname || "") + " " + (p.lastname || "")).trim()}" | cargo="${p.cargo || p.qual_o_cargo || "-"}" | ${p.city || "-"}/${p.state || "-"} | tel=${p.phone || "-"} mob=${p.mobilephone || "-"} | stage=${STAGE_LABEL[p.lifecyclestage] || p.lifecyclestage || "-"}`);
        samplesByEntidade.set(ent, arr);
      }
    }
    after = j.paging && j.paging.next && j.paging.next.after;
    pages++;
    await sleep(300);
  } while (after && pages < 15);

  console.log(`Total HubSpot: ${total}  (varridos em ${pages} páginas)\n`);
  dump("Por REGIÃO:", porRegiao);
  dump("\nPor TIPO DE ENTIDADE:", porEntidade);
  dump("\nPor TIPO DE PRODUTO:", porProduto);
  dump("\nPor STAGE (fase do ciclo):", porStage);
  dump("\nCRUZAMENTO Região || Entidade:", cross);

  console.log("\n===== C) AMOSTRAS por tipo_de_entidade =====");
  for (const [ent, arr] of samplesByEntidade.entries()) {
    console.log(`\n▸ tipo_de_entidade = "${ent}"`);
    arr.forEach((s) => console.log("   - " + s));
  }

  console.log("\n✅ Parte 2 concluída (somente leitura).");
}
main().catch((e) => { console.error("FALHA:", e); process.exit(1); });
