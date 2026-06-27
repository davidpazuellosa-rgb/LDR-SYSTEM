// Aluno a Bordo — cria/atualiza a base de Secretarias de Educação a partir do HubSpot.
// Fonte: 8 LISTAS do HubSpot (Secretarias + Contatos × 4 regiões). NÃO usa planilha.
// Reaproveita os campos existentes do Contact (sem mudar o schema) e NÃO mexe no
// fluxo do "Cidade na Mão". Idempotente: identifica cada contato pelo hubspotId.
import { prisma } from "@/lib/prisma";

const BASE_NAME = "Aluno a Bordo";
const CAMPANHA = "Aluno a Bordo";
const STAGE = { incorreto: "1320556150", atualizado: "1320496031" };

// id da lista, região "limpa" e tipo (secretaria = instituição, pessoa = contato dela)
const LISTS = [
  { id: "6046", regiao: "Norte", tipo: "secretaria" },
  { id: "6052", regiao: "Sudeste", tipo: "secretaria" },
  { id: "6048", regiao: "Centro-Oeste", tipo: "secretaria" },
  { id: "6050", regiao: "Sul", tipo: "secretaria" },
  { id: "6040", regiao: "Norte", tipo: "pessoa" },
  { id: "6037", regiao: "Sudeste", tipo: "pessoa" },
  { id: "6042", regiao: "Centro-Oeste", tipo: "pessoa" },
  { id: "6044", regiao: "Sul", tipo: "pessoa" },
] as const;

const PROPS = ["firstname", "lastname", "phone", "mobilephone", "city", "state", "cargo", "email", "hubspot_owner_id", "lifecyclestage"];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const onlyDigits = (s?: string | null) => (s || "").replace(/\D/g, "");
const validPhone = (s?: string | null) => { const d = onlyDigits(s); return d.length >= 10 && d.length <= 13; };
// "Tem número OK?" — separa vários números por separadores fortes (/ ; , tab, quebra,
// "e", "ou") e aceita se PELO MENOS um pedaço for um telefone válido. Não corta em
// espaços simples (senão quebraria um número único tipo "(69) 9 8100-7382").
const splitNums = (s?: string | null) => (s || "").split(/[/;,\n\t]| e | ou /i);
const hasValidNumber = (s?: string | null) => splitNums(s).some((p) => validPhone(p));

type Props = Record<string, string | undefined>;

async function hs(pathUrl: string, init?: RequestInit) {
  const token = process.env.HUBSPOT_TOKEN;
  const r = await fetch("https://api.hubapi.com" + pathUrl, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  return r.json();
}

async function fetchOwners(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let after: string | undefined;
  do {
    if (after) await sleep(300);
    const j = await hs(`/crm/v3/owners?limit=100${after ? `&after=${after}` : ""}`);
    for (const o of j.results || []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ").trim() || o.email || String(o.id);
      map.set(String(o.id), name);
    }
    after = j.paging?.next?.after;
  } while (after);
  return map;
}

async function listMembers(id: string): Promise<string[]> {
  const ids: string[] = [];
  let after: string | undefined;
  do {
    if (after) await sleep(150);
    const j = await hs(`/crm/v3/lists/${id}/memberships?limit=100${after ? `&after=${after}` : ""}`);
    for (const m of j.results || []) ids.push(String(m.recordId || m.id));
    after = j.paging?.next?.after;
  } while (after);
  return ids;
}

async function batchRead(ids: string[]): Promise<{ id: string; properties: Props }[]> {
  const out: { id: string; properties: Props }[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    if (i > 0) await sleep(200);
    const inputs = ids.slice(i, i + 100).map((id) => ({ id }));
    const j = await hs(`/crm/v3/objects/contacts/batch/read`, { method: "POST", body: JSON.stringify({ properties: PROPS, inputs }) });
    out.push(...(j.results || []));
  }
  return out;
}

export type PulledContact = {
  hubspotId: string; regiao: string; tipo: string; nome: string;
  cidade: string | null; estado: string | null; telefone: string | null; whatsapp: string | null;
  cargo: string | null; ownerId: string | null; incorretoCRM: boolean; naFila: boolean; origem: string;
};

// Puxa os contatos das 8 listas (somente leitura). Deduplica por hubspotId.
export async function pullAlunoABordo(): Promise<PulledContact[]> {
  const byId = new Map<string, PulledContact>();
  for (const L of LISTS) {
    const ids = await listMembers(L.id);
    const contatos = await batchRead(ids);
    for (const c of contatos) {
      if (byId.has(c.id)) continue; // já visto noutra lista
      const p = c.properties || {};
      const tel = (L.tipo === "pessoa" ? (p.mobilephone || p.phone) : (p.phone || p.mobilephone)) || "";
      const incorretoCRM = p.lifecyclestage === STAGE.incorreto;
      byId.set(c.id, {
        hubspotId: c.id, regiao: L.regiao, tipo: L.tipo,
        nome: ((p.firstname || "") + " " + (p.lastname || "")).trim(),
        cidade: p.city || null, estado: p.state || null,
        telefone: tel || null, whatsapp: p.mobilephone || null, cargo: p.cargo || null,
        ownerId: p.hubspot_owner_id || null,
        incorretoCRM, naFila: !hasValidNumber(tel) || incorretoCRM,
        origem: `Lista ${L.tipo === "secretaria" ? "Secretarias" : "Contatos"} ${L.regiao}`,
      });
    }
  }
  return [...byId.values()];
}

let running = false;
let ensuredUnique = false;

// Impede duplicar contatos quando duas execuções (cron + sync manual) rodam
// concorrentes em instâncias diferentes. Cria um índice único parcial em
// (baseId, hubspotId) via SQL — produção não pode ser migrada por fora. Antes,
// remove duplicatas pré-existentes mantendo a linha de menor id por par.
async function ensureContactHubspotUnique() {
  if (ensuredUnique) return;
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Contact" c USING "Contact" d WHERE c."baseId" = d."baseId" AND c."hubspotId" = d."hubspotId" AND c."hubspotId" IS NOT NULL AND c.id > d.id;`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Contact_baseId_hubspotId_key" ON "Contact" ("baseId", "hubspotId") WHERE "hubspotId" IS NOT NULL;`
  );
  ensuredUnique = true;
}

// Cria/atualiza a base local "Aluno a Bordo" a partir do HubSpot e gera as correções.
export async function importAlunoABordo(): Promise<{ ok: boolean; detail?: string; resumo?: Record<string, number> }> {
  if (!process.env.HUBSPOT_TOKEN) return { ok: false, detail: "sem token" };
  if (running) return { ok: false, detail: "já em execução" };
  running = true;
  try {
    await ensureContactHubspotUnique();
    const owners = await fetchOwners();
    const pulled = await pullAlunoABordo();
    if (!pulled.length) return { ok: false, detail: "nenhum contato retornado das listas" };

    let base = await prisma.base.findFirst({ where: { name: BASE_NAME } });
    if (!base) {
      base = await prisma.base.create({
        data: { name: BASE_NAME, description: "Secretarias de Educação — Aluno a Bordo (HubSpot)", source: "import" },
      });
    }

    const existentes = await prisma.contact.findMany({ where: { baseId: base.id }, select: { id: true, hubspotId: true, status: true } });
    const idByHub = new Map(existentes.map((e) => [e.hubspotId, e.id]));
    // Status local atual por hubspotId — para não reverter a marca "não encontrado" do LDR.
    const statusByHub = new Map(existentes.map((e) => [e.hubspotId, e.status]));

    const dataOf = (c: PulledContact) => {
      const ownerName = c.ownerId ? owners.get(String(c.ownerId)) || null : null;
      const nome = c.tipo === "pessoa" && c.cargo ? `${c.nome} — ${c.cargo}` : c.nome;
      return {
        baseId: base!.id, campanha: CAMPANHA, regiao: c.regiao,
        cidade: c.cidade, estado: c.estado, nomePrefeito: nome,
        telefonePrefeitura: c.telefone, whatsapp: c.whatsapp,
        setor: "Secretaria de Educação", origemContato: c.origem, hubspotId: c.hubspotId,
        ...(ownerName ? { proprietario: ownerName } : {}),
        status: c.naFila ? "telefone_incorreto" : "ok",
      };
    };

    const novos = pulled.filter((c) => !idByHub.has(c.hubspotId));
    const antigos = pulled.filter((c) => idByHub.has(c.hubspotId));

    if (novos.length) {
      await prisma.contact.createMany({ data: novos.map(dataOf), skipDuplicates: true });
    }
    // updates em lote (transação por blocos de 100)
    for (let i = 0; i < antigos.length; i += 100) {
      const bloco = antigos.slice(i, i + 100);
      await prisma.$transaction(
        bloco.map((c) => {
          const data = dataOf(c);
          // Preserva a decisão local do LDR: não reverte "telefone não encontrado".
          if (statusByHub.get(c.hubspotId) === "telefone_nao_encontrado") {
            delete (data as { status?: string }).status;
          }
          return prisma.contact.update({ where: { id: idByHub.get(c.hubspotId)! }, data });
        })
      );
    }

    // re-mapeia hubspotId -> id local (inclui os recém-criados)
    const todos = await prisma.contact.findMany({ where: { baseId: base.id }, select: { id: true, hubspotId: true } });
    const idByHub2 = new Map(todos.map((e) => [e.hubspotId, e.id]));

    // correções pendentes para quem está na fila e ainda não tem
    // Não recoloca na fila quem o LDR já marcou como "não encontrado".
    const naoEncontrado = (c: PulledContact) => statusByHub.get(c.hubspotId) === "telefone_nao_encontrado";
    const filaIds = pulled.filter((c) => c.naFila && !naoEncontrado(c)).map((c) => idByHub2.get(c.hubspotId)).filter(Boolean) as string[];
    let novasCorrecoes = 0;
    if (filaIds.length) {
      const jaPendentes = await prisma.correction.findMany({ where: { contactId: { in: filaIds }, status: "pending" }, select: { contactId: true } });
      const pend = new Set(jaPendentes.map((p) => p.contactId));
      const faltam = pulled.filter((c) => c.naFila && !naoEncontrado(c) && idByHub2.get(c.hubspotId) && !pend.has(idByHub2.get(c.hubspotId)!));
      if (faltam.length) {
        await prisma.correction.createMany({
          data: faltam.map((c) => ({
            contactId: idByHub2.get(c.hubspotId)!, field: "telefonePrefeitura", oldValue: c.telefone,
            reason: c.incorretoCRM ? "Telefone Incorreto (Fase do Ciclo de Vida no HubSpot)" : "Telefone ausente/inválido (Aluno a Bordo)",
            status: "pending",
          })),
          skipDuplicates: true,
        });
        novasCorrecoes = faltam.length;
      }
    }

    return { ok: true, resumo: { total: pulled.length, criados: novos.length, atualizados: antigos.length, naFila: filaIds.length, novasCorrecoes } };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  } finally {
    running = false;
  }
}
