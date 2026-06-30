// Escrita no HubSpot — usada quando o LDR corrige um telefone.
// Atualiza o telefone do contato e muda a Fase do Ciclo de Vida para "Telefone Atualizado".

const STAGE_TELEFONE_ATUALIZADO = "1320496031";

// Etapa "Telefone não encontrado (LDR)": o ID interno é descoberto automaticamente
// pelo NOME da etapa (qualquer opção do lifecyclestage cujo rótulo contenha
// "encontrado"). Pode ser forçado via env HUBSPOT_STAGE_NAO_ENCONTRADO.
let stageNaoEncontradoCache: string | null = null;
async function resolveStageNaoEncontrado(token: string): Promise<string> {
  if (process.env.HUBSPOT_STAGE_NAO_ENCONTRADO) return process.env.HUBSPOT_STAGE_NAO_ENCONTRADO;
  if (stageNaoEncontradoCache) return stageNaoEncontradoCache;
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/properties/contacts/lifecyclestage", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return "";
    const data = await res.json();
    const options: { label?: string; value?: string }[] = data?.options || [];
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const hit = options.find((o) => o.label && norm(o.label).includes("encontrado"));
    stageNaoEncontradoCache = hit?.value || "";
    return stageNaoEncontradoCache;
  } catch {
    return "";
  }
}

type PushOptions = {
  hasWhatsapp?: boolean;
  institucional?: boolean;
  pessoaNome?: string;
  pessoaCargo?: string;
};

// Lê o firstname atual do contato, para concatenar com o nome digitado pelo LDR
// (ex.: "Jorge - Prefeitura de Manaus"). Best-effort: se falhar, volta vazio.
async function getFirstname(hubspotId: string, token: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${hubspotId}?properties=firstname`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) return "";
    const data = await res.json();
    return String(data?.properties?.firstname || "").trim();
  } catch {
    return "";
  }
}

export async function pushCorrectionToHubspot(
  hubspotId: string,
  novoTelefone: string,
  options?: PushOptions
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return { ok: false, error: "sem token" };
  if (!hubspotId) return { ok: false, error: "contato sem hubspotId (rode a sincronização)" };

  try {
    const properties: Record<string, string> = {
      phone: novoTelefone,
      lifecyclestage: STAGE_TELEFONE_ATUALIZADO,
    };

    // Tem WhatsApp (Sim/Não) — envia a resposta nos dois casos.
    if (typeof options?.hasWhatsapp === "boolean") {
      properties.tem_whatsapp = options.hasWhatsapp ? "Sim" : "Não";
    }

    // Contato institucional (Sim/Não): a propriedade usa os valores "true"/"false".
    if (typeof options?.institucional === "boolean") {
      properties.contato_institucional = options.institucional ? "true" : "false";
    }

    // Quando NÃO é institucional, registra a pessoa: cargo (jobtitle) e nome
    // concatenado ao nome que já estava no contato do HubSpot.
    if (options?.institucional === false) {
      if (options.pessoaCargo) {
        properties.jobtitle = options.pessoaCargo;
      }
      if (options.pessoaNome) {
        const atual = await getFirstname(hubspotId, token);
        properties.firstname = atual ? `${options.pessoaNome} - ${atual}` : options.pessoaNome;
      }
    }

    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${hubspotId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Marca no HubSpot que o LDR procurou e não achou o número: muda só a Fase do
// Ciclo de Vida para "Telefone não encontrado pelo LDR". Fica DESLIGADO até a
// etapa existir (STAGE_NAO_ENCONTRADO vazio) — depois é só preencher o ID.
export async function pushNaoEncontradoToHubspot(
  hubspotId: string
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return { ok: false, error: "sem token" };
  if (!hubspotId) return { ok: false, error: "contato sem hubspotId (rode a sincronização)" };
  const stage = await resolveStageNaoEncontrado(token);
  if (!stage) return { ok: false, error: "etapa 'Telefone não encontrado' não encontrada no HubSpot" };
  try {
    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${hubspotId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties: { lifecyclestage: stage } }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
