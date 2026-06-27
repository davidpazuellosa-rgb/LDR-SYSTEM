// Sincronização AUTOMÁTICA com o HubSpot — somente LEITURA do CRM.
// Traz, para a base local: Fase do Ciclo de Vida (Telefone Incorreto/Atualizado)
// e o Proprietário do contato. É NÃO DESTRUTIVA: não desfaz correções locais.
import { prisma } from "@/lib/prisma";

const BASE_NAME = "Cidade na mão - Região Nordeste";
const CAMPANHA = "Cidade Na Mão 2026";
const REGIAO = "Nordeste";
const STAGE = { incorreto: "1320556150", atualizado: "1320496031" };

const UF: Record<string, string> = {
  alagoas: "AL", bahia: "BA", ceara: "CE", maranhao: "MA", paraiba: "PB",
  pernambuco: "PE", piaui: "PI", "rio grande do norte": "RN", sergipe: "SE",
};
const SIGLAS = new Set(Object.values(UF));
const norm = (s?: string | null) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const onlyDigits = (value?: string | null) => (value || "").replace(/\D/g, "");
const isValidPhone = (value?: string | null) => {
  const digits = onlyDigits(value);
  return digits.length >= 10 && digits.length <= 13;
};

type Props = Record<string, string | undefined>;
function parse(p: Props) {
  const nome = ((p.firstname || "") + " " + (p.lastname || "")).trim();
  let uf = "";
  const paren = nome.match(/\(([^)]+)\)/);
  if (paren) uf = UF[norm(paren[1])] || (SIGLAS.has(paren[1].toUpperCase()) ? paren[1].toUpperCase() : "");
  if (!uf) { const sl = nome.match(/\/\s*([A-Za-z]{2})\b/); if (sl && SIGLAS.has(sl[1].toUpperCase())) uf = sl[1].toUpperCase(); }
  if (!uf && p.state) uf = UF[norm(p.state)] || (SIGLAS.has((p.state || "").toUpperCase()) ? (p.state as string).toUpperCase() : "");
  let cidade = p.city || "";
  if (!cidade) cidade = nome.replace(/\([^)]*\)/g, "").replace(/\/.*$/, "").replace(/^.*?prefeitura\s+(municipal\s+)?(de|do|da|dos|das)?\s*/i, "").trim();
  return { cidade, uf };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
    if (after) await sleep(400);
    const j = await hs(`/crm/v3/owners?limit=100${after ? `&after=${after}` : ""}`);
    for (const o of j.results || []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ").trim() || o.email || String(o.id);
      map.set(String(o.id), name);
    }
    after = j.paging?.next?.after;
  } while (after);
  return map;
}

// HubSpot Search API: limite de ~4 req/s — aguarda 350 ms entre páginas.
async function search(extraFilters: object[], properties: string[]) {
  const out: { id: string; properties: Props }[] = [];
  let after: string | undefined;
  do {
    if (after) await sleep(350);
    const body: Record<string, unknown> = {
      filterGroups: [{ filters: [
        { propertyName: "campanha", operator: "EQ", value: CAMPANHA },
        { propertyName: "regiao", operator: "EQ", value: REGIAO },
        ...extraFilters,
      ] }],
      properties,
      limit: 200, // máximo permitido — menos páginas, menos chamadas
    };
    if (after) body.after = after;
    const j = await hs("/crm/v3/objects/contacts/search", { method: "POST", body: JSON.stringify(body) });
    if (j.status === "error") throw new Error(j.message);
    out.push(...(j.results || []));
    after = j.paging?.next?.after;
  } while (after);
  return out;
}

export type SyncResult = {
  ok: boolean;
  detail?: string;
  syncedAt?: number; // epoch ms da última sync bem-sucedida
  throttled?: boolean; // true quando reusou o resultado recente sem chamar o HubSpot
  running?: boolean; // true quando já havia uma sync em andamento
};

// Estado em memória (por instância) para coordenar gatilhos automáticos:
//  - running:    evita duas syncs simultâneas na mesma instância
//  - lastResult: último resultado bem-sucedido (devolvido em chamadas throttladas)
//  - THROTTLE:   janela mínima entre syncs reais quando NÃO é forçado
let running = false;
let lastResult: SyncResult | null = null;
const THROTTLE_MS = 45_000;

export async function syncFromCrm(opts?: { force?: boolean }): Promise<SyncResult> {
  const force = opts?.force ?? false;
  if (!process.env.HUBSPOT_TOKEN) return { ok: false, detail: "sem token" };

  // Já em execução: devolve o último resultado conhecido sem disparar outra chamada.
  if (running) return lastResult ? { ...lastResult, running: true } : { ok: false, detail: "já em execução", running: true };

  // Throttle: se sincronizou há pouco e não é forçado, reusa o resultado recente.
  if (!force && lastResult?.ok && lastResult.syncedAt && Date.now() - lastResult.syncedAt < THROTTLE_MS) {
    return { ...lastResult, throttled: true };
  }

  running = true;
  try {
    const base = await prisma.base.findFirst({ where: { name: BASE_NAME } });
    if (!base) return { ok: false, detail: "base não encontrada" };

    const locais = await prisma.contact.findMany({
      where: { baseId: base.id, deletedAt: null },
      select: { id: true, cidade: true, estado: true, status: true, hubspotId: true, proprietario: true, telefonePrefeitura: true },
    });
    const byKey = new Map<string, string>();
    const byCity = new Map<string, string[]>();
    const statusOf = new Map<string, string>();
    const hubspotIdOf = new Map<string, string | null>();
    const proprietarioOf = new Map<string, string | null>();
    const phoneOf = new Map<string, string | null>();
    for (const c of locais) {
      statusOf.set(c.id, c.status);
      hubspotIdOf.set(c.id, c.hubspotId);
      proprietarioOf.set(c.id, c.proprietario);
      phoneOf.set(c.id, c.telefonePrefeitura);
      const k = norm(c.cidade) + "|" + norm(c.estado);
      if (norm(c.cidade)) { byKey.set(k, c.id); byCity.set(norm(c.cidade), [...(byCity.get(norm(c.cidade)) || []), c.id]); }
    }
    const matchId = (cidade: string, uf: string) => {
      const k = norm(cidade) + "|" + norm(uf);
      if (byKey.has(k)) return byKey.get(k)!;
      const a = byCity.get(norm(cidade));
      return a && a.length === 1 ? a[0] : null;
    };

    // ---- Proprietário + hubspotId (só grava o que mudou) ----
    const owners = await fetchOwners();
    await sleep(400);
    const all = await search([], ["firstname", "lastname", "city", "state", "hubspot_owner_id"]);

    const ownerBatch: { id: string; hubspotId: string; proprietario?: string }[] = [];
    for (const c of all) {
      if (!norm((c.properties.firstname || "") + (c.properties.lastname || "")).includes("prefeitura")) continue;
      const { cidade, uf } = parse(c.properties);
      const id = matchId(cidade, uf);
      if (!id) continue;
      const ownerName = owners.get(String(c.properties.hubspot_owner_id || "")) || null;
      const needHubspot = hubspotIdOf.get(id) !== c.id;
      const needOwner = !!ownerName && proprietarioOf.get(id) !== ownerName;
      if (!needHubspot && !needOwner) continue; // já sincronizado — pula
      ownerBatch.push({ id, hubspotId: c.id, ...(ownerName ? { proprietario: ownerName } : {}) });
    }
    if (ownerBatch.length > 0) {
      await prisma.$transaction(
        ownerBatch.map(({ id, hubspotId, proprietario }) =>
          prisma.contact.update({ where: { id }, data: { hubspotId, ...(proprietario ? { proprietario } : {}) } })
        )
      );
    }
    const ownerUpdates = ownerBatch.filter((b) => b.proprietario).length;

    // ---- Status (não destrutivo) ----
    // Chamadas sequenciais — Search API tem limite de ~4 req/s; paralelo causa 429.
    await sleep(400);
    const incorretos = await search([{ propertyName: "lifecyclestage", operator: "EQ", value: STAGE.incorreto }], ["firstname", "lastname", "city", "state"]);
    await sleep(400);
    const atualizados = await search([{ propertyName: "lifecyclestage", operator: "EQ", value: STAGE.atualizado }], ["firstname", "lastname", "city", "state", "phone"]);

    // Atualizado no CRM → batch: atualiza contato + resolve correção pendente (só o que mudou)
    const atzBatch: { id: string; phone: string }[] = [];
    for (const c of atualizados) {
      const { cidade, uf } = parse(c.properties);
      const id = matchId(cidade, uf);
      if (!id) continue;
      const newValue = c.properties.phone || "";
      if (!isValidPhone(newValue)) continue;
      if (phoneOf.get(id) === newValue && statusOf.get(id) === "telefone_atualizado") continue; // já atualizado
      atzBatch.push({ id, phone: newValue });
    }
    if (atzBatch.length > 0) {
      const now = new Date();
      await prisma.$transaction([
        ...atzBatch.map(({ id, phone }) =>
          prisma.contact.update({ where: { id }, data: { telefonePrefeitura: phone, status: "telefone_atualizado" } })
        ),
        ...atzBatch.map(({ id, phone }) =>
          prisma.correction.updateMany({ where: { contactId: id, status: "pending" }, data: { newValue: phone, status: "resolved", resolvedAt: now } })
        ),
      ]);
    }

    // Incorreto no CRM → batch: marca status + cria correção se não existir (só o que mudou)
    const incIds: string[] = [];
    for (const c of incorretos) {
      const { cidade, uf } = parse(c.properties);
      const id = matchId(cidade, uf);
      if (!id) continue;
      // preserva decisão local: correção feita OU "não encontrado" pelo LDR
      if (statusOf.get(id) === "telefone_atualizado" || statusOf.get(id) === "telefone_nao_encontrado") continue;
      incIds.push(id);
    }
    if (incIds.length > 0) {
      const toMark = incIds.filter((id) => statusOf.get(id) !== "telefone_incorreto");
      if (toMark.length > 0) {
        await prisma.contact.updateMany({ where: { id: { in: toMark } }, data: { status: "telefone_incorreto" } });
      }
      const existing = await prisma.correction.findMany({
        where: { contactId: { in: incIds }, status: "pending" },
        select: { contactId: true },
      });
      const existingSet = new Set(existing.map((e) => e.contactId));
      const needsNew = incIds.filter((id) => !existingSet.has(id));
      if (needsNew.length > 0) {
        const phones = await prisma.contact.findMany({
          where: { id: { in: needsNew } },
          select: { id: true, telefonePrefeitura: true },
        });
        await prisma.correction.createMany({
          data: phones.map((c) => ({
            contactId: c.id, field: "telefonePrefeitura", oldValue: c.telefonePrefeitura || null,
            reason: "Telefone Incorreto (Fase do Ciclo de Vida no HubSpot)", status: "pending",
          })),
          skipDuplicates: true,
        });
      }
    }

    const result: SyncResult = {
      ok: true,
      detail: `owners:${ownerUpdates} incorreto:${incorretos.length} atualizado:${atualizados.length}`,
      syncedAt: Date.now(),
    };
    lastResult = result;
    return result;
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  } finally {
    running = false;
  }
}
