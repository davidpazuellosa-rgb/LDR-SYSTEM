// Integração HubSpot — somente CONEXÃO (read-only).
// Não envia nem lê dados de contatos do CRM. Apenas verifica se o token é válido.

export function isHubspotConfigured(): boolean {
  return !!process.env.HUBSPOT_TOKEN;
}

export type HubspotConnection =
  | { ok: true; portalId?: number; accountType?: string; timeZone?: string; uiDomain?: string }
  | { ok: false; error: string };

// Consulta os detalhes da conta no HubSpot para confirmar que o token funciona.
// Endpoint read-only: GET /account-info/v3/details (não toca em contatos/empresas).
export async function testHubspotConnection(): Promise<HubspotConnection> {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return { ok: false, error: "Token não configurado (HUBSPOT_TOKEN vazio no .env)." };

  try {
    const res = await fetch("https://api.hubapi.com/account-info/v3/details", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (res.status === 401) return { ok: false, error: "Token inválido ou expirado (401)." };
    if (res.status === 403)
      return { ok: false, error: "Token sem permissão. Habilite um escopo de leitura no Private App (403)." };
    if (!res.ok) return { ok: false, error: `Erro do HubSpot (HTTP ${res.status}).` };

    const data = await res.json();
    return {
      ok: true,
      portalId: data.portalId,
      accountType: data.accountType,
      timeZone: data.timeZone,
      uiDomain: data.uiDomain,
    };
  } catch (e) {
    return { ok: false, error: `Falha de rede ao falar com o HubSpot: ${(e as Error).message}` };
  }
}
