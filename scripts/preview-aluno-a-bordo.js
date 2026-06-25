// FASE 0 (preview final) — SOMENTE LEITURA. Puxa as 8 listas reais do Aluno a Bordo,
// classifica secretaria/pessoa por região e calcula quem entraria na FILA de correção
// (telefone ausente/inválido OU stage "Telefone Incorreto"). NÃO escreve nada.
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
async function hsGet(p) { const r = await fetch("https://api.hubapi.com" + p, { headers: H }); return { status: r.status, body: await r.json().catch(() => ({})) }; }
async function hsPost(p, b) { const r = await fetch("https://api.hubapi.com" + p, { method: "POST", headers: H, body: JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => ({})) }; }

const STAGE_INCORRETO = "1320556150";
const onlyDigits = (s) => (s || "").replace(/\D/g, "");
const validPhone = (s) => { const d = onlyDigits(s); return d.length >= 10 && d.length <= 13; };
// "Tem número OK?" — separa vários números (/ , ; "e" "ou") e aceita se PELO MENOS um for válido.
const splitNums = (s) => (s || "").split(/[\/;,\n]| e | ou /i);
const hasValidNumber = (s) => splitNums(s).some((part) => validPhone(part));

// As 8 listas (id, região "limpa", tipo)
const LISTS = [
  { id: "6046", regiao: "Norte", tipo: "secretaria" },
  { id: "6052", regiao: "Sudeste", tipo: "secretaria" },
  { id: "6048", regiao: "Centro-Oeste", tipo: "secretaria" },
  { id: "6050", regiao: "Sul", tipo: "secretaria" },
  { id: "6040", regiao: "Norte", tipo: "pessoa" },
  { id: "6037", regiao: "Sudeste", tipo: "pessoa" },
  { id: "6042", regiao: "Centro-Oeste", tipo: "pessoa" },
  { id: "6044", regiao: "Sul", tipo: "pessoa" },
];
const PROPS = ["firstname", "lastname", "phone", "mobilephone", "city", "state", "regiao", "lifecyclestage", "cargo", "email"];

async function listMembers(id) {
  const ids = []; let after;
  do {
    const r = await hsGet(`/crm/v3/lists/${id}/memberships?limit=100${after ? `&after=${after}` : ""}`);
    if (r.status >= 400) { console.log(`  (erro membros lista ${id}: ${r.status})`); break; }
    for (const m of r.body.results || []) ids.push(m.recordId || m.id);
    after = r.body.paging && r.body.paging.next && r.body.paging.next.after;
    await sleep(120);
  } while (after);
  return ids;
}
async function batchRead(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const inputs = ids.slice(i, i + 100).map((id) => ({ id }));
    const r = await hsPost(`/crm/v3/objects/contacts/batch/read`, { properties: PROPS, inputs });
    out.push(...(r.body.results || []));
    await sleep(200);
  }
  return out;
}

async function main() {
  if (!TK) throw new Error("HUBSPOT_TOKEN não encontrado no .env");
  const seen = new Set();
  const rows = []; // {regiao, tipo, nome, phoneUsado, valido, incorretoCRM, naFila}
  const samplesFila = [];

  for (const L of LISTS) {
    const ids = await listMembers(L.id);
    const contatos = await batchRead(ids);
    for (const c of contatos) {
      const p = c.properties || {};
      const phoneUsado = L.tipo === "pessoa" ? (p.mobilephone || p.phone || "") : (p.phone || p.mobilephone || "");
      const valido = hasValidNumber(phoneUsado);
      const incorretoCRM = p.lifecyclestage === STAGE_INCORRETO;
      const naFila = !valido || incorretoCRM;
      let categoria = null;
      if (naFila) {
        if (onlyDigits(phoneUsado).length === 0) categoria = incorretoCRM ? "vazio+incorreto" : "vazio";
        else if (incorretoCRM) categoria = "marcado_incorreto";
        else categoria = "formato_torto";
      }
      const nome = ((p.firstname || "") + " " + (p.lastname || "")).trim();
      rows.push({ id: c.id, regiao: L.regiao, tipo: L.tipo, nome, cidade: p.city, uf: p.state, phoneUsado, valido, incorretoCRM, naFila, categoria });
      if (naFila && samplesFila.length < 12) samplesFila.push({ regiao: L.regiao, tipo: L.tipo, nome, cidade: p.city, uf: p.state, phone: phoneUsado || "(vazio)", motivo: incorretoCRM ? "marcado Incorreto" : "telefone inválido/ausente" });
      seen.add(c.id);
    }
    console.log(`Lista ${L.id} (${L.tipo} ${L.regiao}): ${ids.length} membros`);
  }

  // Agregações
  const grid = {}; // regiao||tipo -> {total, fila}
  const cats = {}; // categoria -> count
  let total = 0, fila = 0, porInvalido = 0, porStage = 0;
  for (const r of rows) {
    const k = r.regiao + " || " + r.tipo;
    grid[k] = grid[k] || { total: 0, fila: 0 };
    grid[k].total++; total++;
    if (r.naFila) { grid[k].fila++; fila++; if (r.incorretoCRM) porStage++; else porInvalido++; cats[r.categoria] = (cats[r.categoria] || 0) + 1; }
  }

  console.log("\n========== RESUMO ALUNO A BORDO ==========");
  console.log(`Contatos únicos: ${seen.size}  |  Linhas (com possível sobreposição entre listas): ${total}`);
  console.log("\nPor região × tipo  →  total / NA FILA:");
  for (const [k, v] of Object.entries(grid).sort()) console.log(`  ${k.padEnd(26)}  ${String(v.total).padStart(4)}  /  ${v.fila} na fila`);
  console.log(`\nFILA TOTAL: ${fila}`);
  console.log(`   • por telefone ausente/inválido: ${porInvalido}`);
  console.log(`   • por marcação "Telefone Incorreto" no CRM: ${porStage}`);
  console.log("\nFila por CATEGORIA (qualidade do telefone):");
  for (const [k, v] of Object.entries(cats).sort((a, b) => b[1] - a[1])) console.log(`   • ${k.padEnd(20)} ${v}`);

  console.log("\nAmostras da fila:");
  samplesFila.forEach((s) => console.log(`  - [${s.tipo} ${s.regiao}] "${s.nome}" | ${s.cidade || "-"}/${s.uf || "-"} | tel=${s.phone} | (${s.motivo})`));

  console.log("\n✅ Preview concluído (somente leitura — nada foi criado/alterado).");
}
main().catch((e) => { console.error("FALHA:", e); process.exit(1); });
