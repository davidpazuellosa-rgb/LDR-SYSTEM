// FASE 0 (parte 3) — SOMENTE LEITURA. Procura as LISTAS do HubSpot ligadas ao
// "Aluno a Bordo 2026" (ex.: "Contatos Norte ...", "Secretarias Centro Oeste ...").
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
async function hsPost(p, body) { const r = await fetch("https://api.hubapi.com" + p, { method: "POST", headers: H, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) }; }

async function main() {
  if (!TK) throw new Error("HUBSPOT_TOKEN não encontrado no .env");

  console.log("===== BUSCA DE LISTAS com 'Aluno a Bordo' =====");
  const res = await hsPost("/crm/v3/lists/search", { query: "Aluno a Bordo", count: 250 });
  if (res.status >= 400) {
    console.log(`ERRO HTTP ${res.status}:`, JSON.stringify(res.body).slice(0, 400));
    console.log("\n(Se for 403, o token do app provavelmente não tem o escopo 'crm.lists.read'.)");
    return;
  }
  const lists = res.body.lists || res.body.results || [];
  console.log(`total=${res.body.total != null ? res.body.total : "?"} | retornados=${lists.length}`);
  if (lists[0]) console.log("shape do 1º:", JSON.stringify(lists[0]).slice(0, 300), "\n");

  // ordena por nome pra leitura
  lists.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  let totalMembros = 0;
  for (const l of lists) {
    const id = l.listId || l.id;
    let size = l.size != null ? l.size : (l.additionalProperties && l.additionalProperties.hs_list_size);
    if (size == null && id) {
      const d = await hsGet(`/crm/v3/lists/${id}`);
      size = d.body.list ? d.body.list.size : d.body.size;
      await sleep(150);
    }
    if (typeof size === "number") totalMembros += size;
    console.log(`- id=${id} | tipo=${l.processingType || "?"} | obj=${l.objectTypeId || "?"} | size=${size != null ? size : "?"} | "${l.name}"`);
  }
  console.log(`\nSoma dos tamanhos: ${totalMembros}`);

  // amostra de membros da 1ª lista "Secretarias" (se houver) pra ver o conteúdo
  const sec = lists.find((l) => /secretaria/i.test(l.name));
  if (sec) {
    const id = sec.listId || sec.id;
    console.log(`\n===== AMOSTRA de membros de "${sec.name}" =====`);
    const mem = await hsGet(`/crm/v3/lists/${id}/memberships?limit=5`);
    const ids = (mem.body.results || []).map((m) => m.recordId || m.id).filter(Boolean);
    console.log("recordIds:", ids.join(", ") || "(nenhum / endpoint diferente)");
    for (const rid of ids.slice(0, 5)) {
      const c = await hsGet(`/crm/v3/objects/contacts/${rid}?properties=firstname,lastname,phone,mobilephone,city,state,regiao,campanha,lifecyclestage,cargo`);
      const p = (c.body.properties) || {};
      console.log(`   • ${rid} | "${((p.firstname || "") + " " + (p.lastname || "")).trim()}" | ${p.city || "-"}/${p.state || "-"} | reg=${p.regiao || "-"} | camp=${p.campanha || "-"} | tel=${p.phone || "-"} mob=${p.mobilephone || "-"} | cargo=${p.cargo || "-"}`);
      await sleep(150);
    }
  }

  console.log("\n✅ Parte 3 concluída (somente leitura).");
}
main().catch((e) => { console.error("FALHA:", e); process.exit(1); });
