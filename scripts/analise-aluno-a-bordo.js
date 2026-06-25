// Análise (SOMENTE LEITURA) do Aluno a Bordo no HubSpot: panorama, fila completa e
// qualidade dos dados. Não escreve nada.
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
async function hsPost(p, b) { const r = await fetch("https://api.hubapi.com" + p, { method: "POST", headers: H, body: JSON.stringify(b) }); return r.json(); }

const STAGE_INCORRETO = "1320556150";
const onlyDigits = (s) => (s || "").replace(/\D/g, "");
const validPhone = (s) => { const d = onlyDigits(s); return d.length >= 10 && d.length <= 13; };
const splitNums = (s) => (s || "").split(/[/;,\n\t]| e | ou /i);
const hasValidNumber = (s) => splitNums(s).some((p) => validPhone(p));
const hasSep = (s) => /[/;,\n\t]| e | ou /i.test(s || "");

const LISTS = [
  { id: "6046", regiao: "Norte", tipo: "secretaria" }, { id: "6052", regiao: "Sudeste", tipo: "secretaria" },
  { id: "6048", regiao: "Centro-Oeste", tipo: "secretaria" }, { id: "6050", regiao: "Sul", tipo: "secretaria" },
  { id: "6040", regiao: "Norte", tipo: "pessoa" }, { id: "6037", regiao: "Sudeste", tipo: "pessoa" },
  { id: "6042", regiao: "Centro-Oeste", tipo: "pessoa" }, { id: "6044", regiao: "Sul", tipo: "pessoa" },
];
const PROPS = ["firstname", "lastname", "phone", "mobilephone", "city", "state", "cargo", "email", "hubspot_owner_id", "lifecyclestage"];

async function listMembers(id) { const ids = []; let after; do { if (after) await sleep(120); const j = await hsGet(`/crm/v3/lists/${id}/memberships?limit=100${after ? `&after=${after}` : ""}`); for (const m of j.results || []) ids.push(String(m.recordId || m.id)); after = j.paging && j.paging.next && j.paging.next.after; } while (after); return ids; }
async function batchRead(ids) { const out = []; for (let i = 0; i < ids.length; i += 100) { if (i) await sleep(200); const j = await hsPost(`/crm/v3/objects/contacts/batch/read`, { properties: PROPS, inputs: ids.slice(i, i + 100).map((id) => ({ id })) }); out.push(...(j.results || [])); } return out; }
async function owners() { const map = new Map(); let after; do { if (after) await sleep(250); const j = await hsGet(`/crm/v3/owners?limit=100${after ? `&after=${after}` : ""}`); for (const o of j.results || []) map.set(String(o.id), [o.firstName, o.lastName].filter(Boolean).join(" ").trim() || o.email || String(o.id)); after = j.paging && j.paging.next && j.paging.next.after; } while (after); return map; }

async function main() {
  if (!TK) throw new Error("sem token");
  const own = await owners();
  const byId = new Map();
  for (const L of LISTS) {
    const contatos = await batchRead(await listMembers(L.id));
    for (const c of contatos) {
      if (byId.has(c.id)) continue;
      const p = c.properties || {};
      const tel = (L.tipo === "pessoa" ? (p.mobilephone || p.phone) : (p.phone || p.mobilephone)) || "";
      const incorretoCRM = p.lifecyclestage === STAGE_INCORRETO;
      byId.set(c.id, { id: c.id, regiao: L.regiao, tipo: L.tipo, nome: ((p.firstname || "") + " " + (p.lastname || "")).trim(), cidade: p.city || "", uf: p.state || "", tel, cargo: p.cargo || "", email: p.email || "", owner: own.get(String(p.hubspot_owner_id || "")) || "", incorretoCRM, naFila: !hasValidNumber(tel) || incorretoCRM });
    }
  }
  const rows = [...byId.values()];

  console.log("================ PANORAMA ================");
  const reg = {}; for (const r of rows) { const k = r.regiao + " / " + r.tipo; reg[k] = (reg[k] || 0) + 1; }
  console.log(`Total: ${rows.length} contatos únicos`);
  for (const [k, v] of Object.entries(reg).sort()) console.log(`  ${k.padEnd(24)} ${v}`);

  console.log("\n================ QUALIDADE DOS TELEFONES ================");
  const comMulti = rows.filter((r) => hasSep(r.tel) && hasValidNumber(r.tel)).length;
  const limpo = rows.filter((r) => !hasSep(r.tel) && validPhone(r.tel)).length;
  const semNum = rows.filter((r) => onlyDigits(r.tel).length === 0).length;
  console.log(`Um número limpo:        ${limpo}`);
  console.log(`Vários números no campo: ${comMulti}  (foram p/ HubSpot como estão, fora da fila)`);
  console.log(`Sem nenhum dígito:       ${semNum}`);
  console.log(`Com proprietário:        ${rows.filter((r) => r.owner).length}`);
  console.log(`Com e-mail:              ${rows.filter((r) => r.email).length}`);
  console.log(`Pessoas com cargo:       ${rows.filter((r) => r.tipo === "pessoa" && r.cargo).length} de ${rows.filter((r) => r.tipo === "pessoa").length}`);

  const fila = rows.filter((r) => r.naFila);
  console.log(`\n================ FILA DE CORREÇÃO (${fila.length}) ================`);
  const regf = {}; for (const r of fila) regf[r.regiao] = (regf[r.regiao] || 0) + 1;
  console.log("Por região: " + Object.entries(regf).map(([k, v]) => `${k}:${v}`).join("  "));
  console.log("");
  fila.sort((a, b) => (a.regiao + a.tipo).localeCompare(b.regiao + b.tipo));
  fila.forEach((r, i) => {
    const motivo = r.incorretoCRM ? "marcado Incorreto no CRM" : onlyDigits(r.tel).length === 0 ? "sem telefone" : "formato inválido";
    console.log(`${String(i + 1).padStart(2)}. [${r.tipo} ${r.regiao}] ${r.cidade}/${r.uf}`);
    console.log(`     ${r.nome}`);
    console.log(`     tel atual: "${r.tel || "(vazio)"}"  → ${motivo}${r.owner ? `  | dono: ${r.owner}` : ""}`);
  });
  console.log("\n✅ Análise concluída (somente leitura).");
}
main().catch((e) => { console.error("FALHA:", e); process.exit(1); });
