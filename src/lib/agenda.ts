// Agenda — leitura das reuniões (meetings) do HubSpot para o calendário.
// SOMENTE LEITURA: busca reuniões numa janela de datas, resolve owners e
// enriquece com o contato (pré-vendedor) e o negócio (vendedor) associados.
// O token fica só no servidor (HUBSPOT_TOKEN) — este módulo roda em route handler.

const HUBSPOT_BASE = "https://api.hubapi.com";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Tipos ────────────────────────────────────────────────────────────────
export type OutcomeCode = "SCHEDULED" | "RESCHEDULED" | "COMPLETED" | "NO_SHOW" | "CANCELED";
export type ResultCat = "agendada" | "concluida" | "naoconcluida";

export interface Meeting {
  id: string;
  title: string;
  start: string; // formato do HubSpot (epoch-ms ou ISO) — parsear com parseHubspotDate
  end: string;
  outcome: string; // código do HubSpot ("" quando sem desfecho)
  body: string;
  ownerId: string;
  createdate: string;
  type: string;
  // preenchidos por enrichMeetings (best-effort; podem ficar vazios):
  contactName: string;
  preVendedorId: string;
  dealId: string;
  dealName: string;
  dealOwnerId: string;
}

export interface AgendaData {
  available: boolean;
  meetings: Meeting[];
  owners: Record<string, string>;
  fetchedAt: string;
  error?: string;
}

// ── Mapeamentos de resultado (rótulo + cor) ───────────────────────────────
export const OUTCOME_LABELS: Record<string, string> = {
  SCHEDULED: "Agendada",
  RESCHEDULED: "Reagendada",
  COMPLETED: "Realizada",
  NO_SHOW: "Não Realizada",
  CANCELED: "Cancelada",
};

// Cor do evento é por RESULTADO: azul agendada, verde realizada, vermelho o resto.
export const RESULT_META: Record<ResultCat, { label: string; color: string }> = {
  agendada: { label: "Agendada", color: "#2563eb" },
  concluida: { label: "Concluída", color: "#16a34a" },
  naoconcluida: { label: "Não concluída", color: "#dc2626" },
};
export const RESULT_ORDER: ResultCat[] = ["agendada", "concluida", "naoconcluida"];

export function outcomeLabel(code: string | null | undefined): string {
  if (!code) return "Sem desfecho";
  return OUTCOME_LABELS[String(code).toUpperCase().trim()] || String(code);
}

export function resultCat(code: string | null | undefined): ResultCat {
  const label = outcomeLabel(code);
  if (label === "Agendada" || label === "Reagendada") return "agendada";
  if (label === "Realizada") return "concluida";
  return "naoconcluida";
}

// Parser robusto: HubSpot pode devolver a data como epoch-ms (string só de
// dígitos) OU ISO. new Date("1719...ms") daria Invalid Date — daí este tratamento.
export function parseHubspotDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = /^\d+$/.test(s) ? new Date(Number(s)) : new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function ownerName(id: string | null | undefined, owners: Record<string, string>): string {
  if (!id) return "Sem responsável";
  return owners[id] || "Owner " + id;
}

// ── Chamada genérica ao HubSpot com retry/backoff (429/5xx) ───────────────
async function hsFetch<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const MAX_TRIES = 6;
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const res = await fetch(HUBSPOT_BASE + path, {
      ...options,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_TRIES) {
      const ra = parseFloat(res.headers.get("Retry-After") || "");
      await sleep(!isNaN(ra) ? ra * 1000 : Math.min(1000 * attempt, 5000));
      continue;
    }
    const bodyTxt = await res.text();
    throw new Error("HubSpot " + res.status + " em " + path + ": " + bodyTxt.slice(0, 500));
  }
  throw new Error("HubSpot: tentativas esgotadas em " + path);
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

interface HsObject {
  id: string;
  properties: Record<string, string>;
}

// owners → { id: nome }
export async function fetchOwners(token: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  let after: string | undefined;
  for (let page = 0; page < 50; page++) {
    const q = after ? "?limit=100&after=" + after : "?limit=100";
    const data = await hsFetch<{
      results?: Array<{ id?: string; ownerId?: string; firstName?: string; lastName?: string; email?: string }>;
      paging?: { next?: { after?: string } };
    }>(token, "/crm/v3/owners" + q);
    (data.results || []).forEach((o) => {
      const id = String(o.id || o.ownerId || "");
      if (!id) return;
      const name =
        o.firstName || o.lastName
          ? [o.firstName, o.lastName].filter(Boolean).join(" ").trim()
          : o.email || "Owner " + id;
      map[id] = name;
    });
    after = data.paging?.next?.after;
    if (!after) break;
  }
  return map;
}

// Associations v4 em lote: fromType → toType. Devolve { fromId: [toId, ...] }.
async function batchReadAssociations(
  token: string,
  fromType: string,
  toType: string,
  ids: string[],
): Promise<Record<string, string[]>> {
  const map: Record<string, string[]> = {};
  for (const part of chunk([...new Set(ids.map(String))], 1000)) {
    const data = await hsFetch<{
      results?: Array<{ from?: { id?: string }; to?: Array<{ toObjectId?: string | number }> }>;
    }>(token, "/crm/v4/associations/" + fromType + "/" + toType + "/batch/read", {
      method: "POST",
      body: JSON.stringify({ inputs: part.map((id) => ({ id: String(id) })) }),
    });
    (data.results || []).forEach((r) => {
      const fromId = String(r.from?.id || "");
      if (!fromId) return;
      map[fromId] = (map[fromId] || []).concat((r.to || []).map((t) => String(t.toObjectId)));
    });
  }
  return map;
}

// Batch read de objetos (até 100 ids/req). Devolve { id: { id, properties } }.
async function batchReadObjects(
  token: string,
  objectType: string,
  ids: string[],
  properties: string[],
): Promise<Record<string, HsObject>> {
  const map: Record<string, HsObject> = {};
  for (const part of chunk([...new Set(ids.map(String))], 100)) {
    const data = await hsFetch<{ results?: Array<{ id: string | number; properties?: Record<string, string> }> }>(
      token,
      "/crm/v3/objects/" + objectType + "/batch/read",
      {
        method: "POST",
        body: JSON.stringify({ inputs: part.map((id) => ({ id: String(id) })), properties }),
      },
    );
    (data.results || []).forEach((r) => {
      map[String(r.id)] = { id: String(r.id), properties: r.properties || {} };
    });
  }
  return map;
}

// Todas as reuniões numa janela de -60/+120 dias.
export async function fetchAllMeetings(token: string): Promise<Meeting[]> {
  const DIA = 86400000;
  const agora = Date.now();
  const inicio = agora - 60 * DIA;
  const fim = agora + 120 * DIA;
  const props = [
    "hs_meeting_title",
    "hs_meeting_start_time",
    "hs_meeting_end_time",
    "hs_meeting_outcome",
    "hs_meeting_body",
    "hubspot_owner_id",
    "hs_createdate",
    "hs_activity_type",
  ];
  const all: Meeting[] = [];
  let after: string | undefined;
  for (let page = 0; page < 200; page++) {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "hs_meeting_start_time",
              operator: "BETWEEN",
              value: String(inicio),
              highValue: String(fim),
            },
          ],
        },
      ],
      sorts: [{ propertyName: "hs_meeting_start_time", direction: "ASCENDING" }],
      properties: props,
      limit: 100,
    };
    if (after) body.after = after;
    const data = await hsFetch<{
      results?: Array<{ id: string | number; properties?: Record<string, string> }>;
      paging?: { next?: { after?: string } };
    }>(token, "/crm/v3/objects/meetings/search", { method: "POST", body: JSON.stringify(body) });
    (data.results || []).forEach((r) => {
      const p = r.properties || {};
      all.push({
        id: String(r.id),
        title: p.hs_meeting_title || "",
        start: p.hs_meeting_start_time || "",
        end: p.hs_meeting_end_time || "",
        outcome: p.hs_meeting_outcome || "",
        body: p.hs_meeting_body || "",
        ownerId: p.hubspot_owner_id || "",
        createdate: p.hs_createdate || "",
        type: p.hs_activity_type || "",
        contactName: "",
        preVendedorId: "",
        dealId: "",
        dealName: "",
        dealOwnerId: "",
      });
    });
    after = data.paging?.next?.after;
    if (!after) break;
    await sleep(120);
  }
  return all;
}

// Enriquece cada reunião com o contato (nome + pré-vendedor) e o negócio (nome
// + vendedor). Best-effort: se as associations falharem, a Agenda segue sem isso.
export async function enrichMeetings(token: string, meetings: Meeting[]): Promise<void> {
  const ids = meetings.map((m) => m.id);
  if (!ids.length) return;
  const [contactAssoc, dealAssoc] = await Promise.all([
    batchReadAssociations(token, "meetings", "contacts", ids),
    batchReadAssociations(token, "meetings", "deals", ids),
  ]);
  const contactIds = [...new Set(Object.values(contactAssoc).flat())];
  const dealIds = [...new Set(Object.values(dealAssoc).flat())];
  const [contactMap, dealMap] = await Promise.all([
    contactIds.length
      ? batchReadObjects(token, "contacts", contactIds, ["hs_full_name_or_email", "hubspot_owner_id"])
      : Promise.resolve({} as Record<string, HsObject>),
    dealIds.length
      ? batchReadObjects(token, "deals", dealIds, ["dealname", "hubspot_owner_id"])
      : Promise.resolve({} as Record<string, HsObject>),
  ]);
  meetings.forEach((m) => {
    const c = (contactAssoc[m.id] || []).map((id) => contactMap[id]).find(Boolean);
    if (c) {
      m.contactName = c.properties.hs_full_name_or_email || "";
      m.preVendedorId = c.properties.hubspot_owner_id || "";
    }
    const d = (dealAssoc[m.id] || []).map((id) => dealMap[id]).find(Boolean);
    if (d) {
      m.dealId = d.id;
      m.dealName = d.properties.dealname || "";
      m.dealOwnerId = d.properties.hubspot_owner_id || "";
    }
  });
}
