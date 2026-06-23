// Escrita no HubSpot — usada quando o LDR corrige um telefone.
// Atualiza o telefone do contato e muda a Fase do Ciclo de Vida para "Telefone Atualizado".

const STAGE_TELEFONE_ATUALIZADO = "1320496031";

export async function pushCorrectionToHubspot(
  hubspotId: string,
  novoTelefone: string,
  options?: { hasWhatsapp?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return { ok: false, error: "sem token" };
  if (!hubspotId) return { ok: false, error: "contato sem hubspotId (rode a sincronização)" };

  try {
    const properties: Record<string, string> = {
      phone: novoTelefone,
      lifecyclestage: STAGE_TELEFONE_ATUALIZADO,
    };

    if (options?.hasWhatsapp) {
      properties.tem_whatsapp = "Sim";
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
