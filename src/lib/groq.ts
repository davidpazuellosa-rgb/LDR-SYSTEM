export type ScannedContact = {
  nome?: string;
  cargo?: string;
  telefone?: string;
  email?: string;
  tipo?: string;
  origem?: string;
  validacao?: {
    status: "ok" | "warning";
    checks: string[];
    warnings: string[];
  };
};

export type ScanResult =
  | { ok: true; contatos: ScannedContact[]; resumo?: string }
  | { ok: false; error: string };

type OrgInput = {
  cidade?: string | null;
  estado?: string | null;
  nomePrefeito?: string | null;
  siteOficial?: string | null;
  telefonePrefeitura?: string | null;
};

function onlyDigits(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

function comparablePhone(value?: string | null) {
  const digits = onlyDigits(value);
  return digits.startsWith("55") ? digits.slice(2) : digits;
}

function hasCompleteBrazilianPhone(value?: string | null) {
  const phone = comparablePhone(value);
  return phone.length >= 10 && phone.length <= 11;
}

function phoneForLookup(value?: string | null) {
  const phone = comparablePhone(value);
  return phone ? `55${phone}` : "";
}

function extractUrl(value?: string | null) {
  const text = value || "";
  const explicit = text.match(/https?:\/\/[^\s)]+/i);
  const bare = text.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?/i);
  const target = explicit?.[0] || (bare?.[0] ? `https://${bare[0]}` : null);
  if (!target) return null;

  try {
    return new URL(target);
  } catch {
    return null;
  }
}

function isTrustedPublicSource(url: URL | null, org: OrgInput) {
  if (!url) return false;

  const host = url.hostname.toLowerCase();
  const officialHost = extractUrl(org.siteOficial)?.hostname.toLowerCase();

  return (
    host.endsWith(".gov.br") ||
    host.includes("camara") ||
    host.includes("prefeitura") ||
    Boolean(officialHost && host === officialHost)
  );
}

async function sourceExists(url: URL | null) {
  if (!url) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "SASI-LDR-Hub/1.0" },
    });
    clearTimeout(timeout);
    return res.status < 400;
  } catch {
    return false;
  }
}

async function validatePhoneExists(phone: string) {
  const key = process.env.IPQS_API_KEY;
  if (!key) return { checked: false as const };

  const lookupPhone = phoneForLookup(phone);
  if (!lookupPhone) return { checked: true as const, valid: false, message: "Número vazio" };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const url = new URL(`https://www.ipqualityscore.com/api/json/phone/${key}/${encodeURIComponent(lookupPhone)}`);
    url.searchParams.set("country", "BR");
    url.searchParams.set("strictness", "1");

    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "SASI-LDR-Hub/1.0" },
    });
    clearTimeout(timeout);

    const data = (await res.json()) as {
      success?: boolean;
      valid?: boolean;
      active?: boolean | null;
      active_status?: string;
      carrier?: string;
      line_type?: string | null;
      message?: string;
    };

    if (!res.ok || data.success === false) {
      return { checked: true as const, valid: null, message: data.message || `IPQS HTTP ${res.status}` };
    }

    return {
      checked: true as const,
      valid: data.valid === true,
      active: data.active,
      carrier: data.carrier,
      lineType: data.line_type,
      activeStatus: data.active_status,
    };
  } catch {
    return { checked: true as const, valid: null, message: "Validação externa indisponível agora" };
  }
}

async function validateScannedContacts(contatos: ScannedContact[], org: OrgInput) {
  const currentPhone = comparablePhone(org.telefonePrefeitura);
  const counts = new Map<string, number>();

  for (const contact of contatos) {
    const phone = comparablePhone(contact.telefone);
    if (!phone) continue;
    counts.set(phone, (counts.get(phone) || 0) + 1);
  }

  return Promise.all(
    contatos.map(async (contact) => {
      const checks: string[] = [];
      const warnings: string[] = [];
      const phone = comparablePhone(contact.telefone);
      const url = extractUrl(contact.origem);
      const hasContactIdentity = Boolean(contact.nome?.trim() || contact.cargo?.trim() || contact.tipo?.trim());
      const hasPublicEvidence = Boolean(url || contact.email?.trim() || contact.origem?.trim());

      if (hasContactIdentity && hasPublicEvidence) {
        checks.push("Contato/órgão identificado em fonte pública");
      } else if (hasContactIdentity) {
        warnings.push("Contato identificado, mas sem fonte pública suficiente");
      } else {
        warnings.push("Fonte não identifica claramente o contato/órgão");
      }

      if (phone.length >= 10 && phone.length <= 11) {
        checks.push("Telefone com formato válido");
      } else if (contact.telefone) {
        warnings.push("Telefone com formato incompleto");
      } else {
        warnings.push("Telefone não informado");
      }

      const phoneValidation = await validatePhoneExists(contact.telefone || "");
      if (phoneValidation.checked) {
        if (phoneValidation.valid === false || phoneValidation.active === false) return null;
        if (phoneValidation.valid === true) {
          const details = [phoneValidation.carrier, phoneValidation.lineType].filter(Boolean).join(" / ");
          checks.push(details ? `Número existe (${details})` : "Número existe na validação externa");
        } else {
          warnings.push(phoneValidation.message || "Validação externa do número inconclusiva");
        }
      }

      if (phone && currentPhone && phone === currentPhone) {
        warnings.push("Número igual ao telefone atual");
      } else if (phone) {
        checks.push("Número diferente do telefone atual");
      }

      if (phone && counts.get(phone)! > 1) {
        warnings.push("Número repetido em outro resultado");
      } else if (phone) {
        checks.push("Número único nesta varredura");
      }

      if (isTrustedPublicSource(url, org)) {
        checks.push("Fonte pública relacionada à prefeitura");
      } else {
        warnings.push("Fonte não parece ser oficial da prefeitura");
      }

      if (await sourceExists(url)) {
        checks.push("Fonte acessível no momento da varredura");
      } else {
        warnings.push("Fonte não abriu agora; isso não indica que o contato não existe");
      }

      return {
        ...contact,
        validacao: {
          status: warnings.length ? ("warning" as const) : ("ok" as const),
          checks,
          warnings,
        },
      };
    }),
  ).then((items) => items.filter((item): item is ScannedContact & { validacao: NonNullable<ScannedContact["validacao"]> } => Boolean(item)));
}

function extractJson(text: string): unknown | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1] || text;
  const arrStart = candidate.indexOf("[");
  const objStart = candidate.indexOf("{");
  const slices: string[] = [];

  if (arrStart !== -1) slices.push(candidate.slice(arrStart));
  if (objStart !== -1) slices.push(candidate.slice(objStart));
  slices.push(candidate);

  for (const slice of slices) {
    try {
      return JSON.parse(slice);
    } catch {
      // Tenta a próxima extração.
    }
  }

  return null;
}

function groqErrorMessage(status: number, body: string) {
  const lower = body.toLowerCase();

  if (status === 429 || lower.includes("rate limit") || lower.includes("tokens per minute")) {
    return "Limite de varreduras atingido no momento. Aguarde alguns instantes e tente novamente.";
  }

  if (status >= 500) {
    return "O serviço de varredura está instável no momento. Tente novamente em instantes.";
  }

  return "Não foi possível concluir a varredura agora. Tente novamente.";
}

function normalizeContacts(value: unknown): ScannedContact[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "object" && value && Array.isArray((value as { contatos?: unknown }).contatos)
      ? (value as { contatos: unknown[] }).contatos
      : [];

  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      nome: String(item.nome || ""),
      cargo: String(item.cargo || ""),
      telefone: String(item.telefone || ""),
      email: String(item.email || ""),
      tipo: String(item.tipo || ""),
      origem: String(item.origem || ""),
    }))
    .filter((item) => hasCompleteBrazilianPhone(item.telefone));
}

export async function scanOrgContacts(org: OrgInput): Promise<ScanResult> {
  const token = process.env.GROQ_API_KEY;
  if (!token) return { ok: false, error: "GROQ_API_KEY não configurada." };

  const model = process.env.GROQ_MODEL || "groq/compound-mini";
  const prompt = `Busque na internet contatos públicos da prefeitura/órgão abaixo.

Cidade: ${org.cidade || ""}
Estado: ${org.estado || ""}
Prefeito(a): ${org.nomePrefeito || ""}
Site oficial conhecido: ${org.siteOficial || ""}
Telefone atual conhecido: ${org.telefonePrefeitura || ""}

Retorne apenas JSON no formato:
[{"nome":"...","cargo":"...","telefone":"...","email":"...","tipo":"gabinete|whatsapp|geral|outro","origem":"URL ou descrição da fonte"}]

Busque em fontes diferentes: site oficial da prefeitura, página de contato, portal da transparência, diário oficial, câmara municipal, redes ou páginas públicas institucionais.
Priorize telefones de gabinete, WhatsApp oficial, recepção geral, secretaria e contatos diretamente ligados ao gabinete do prefeito.
Evite devolver resultados com o mesmo telefone. Se encontrar o mesmo número em várias fontes, mantenha apenas a melhor fonte.
Não invente telefone. Só retorne telefone quando houver fonte pública. Prefira números diferentes do telefone atual conhecido.
Retorne somente resultados com telefone completo com DDD. Se encontrar apenas e-mail, site ou ramal sem DDD, não inclua esse resultado.
Valide existência por evidência pública: nome/cargo/órgão + telefone em site oficial, portal público, câmara, diário oficial, página institucional ou fonte pública relacionada.
Não diga nem conclua que o contato "não existe" por ligação não atendida, ocupado, atendimento por terceiro, caixa postal, falha temporária ou fonte fora do ar. Essas situações só significam que a existência não foi confirmada naquele momento.
Se a fonte indicar que o órgão/contato existe, mas o telefone estiver incerto, retorne o contato com telefone vazio em vez de inventar número.
Se não encontrar algum campo, use string vazia. Não escreva nada além do JSON.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Você busca contatos públicos de órgãos e responde somente JSON válido." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: groqErrorMessage(res.status, text) };
    }

    const data = await res.json();
    const content = String(data?.choices?.[0]?.message?.content || "");
    const parsed = extractJson(content);
    const contatos = await validateScannedContacts(normalizeContacts(parsed), org);

    return {
      ok: true,
      contatos,
      resumo: contatos.length ? `${contatos.length} contato(s) encontrado(s).` : "Nenhum contato retornado.",
    };
  } catch (error) {
    return { ok: false, error: `Falha Groq: ${(error as Error).message}` };
  }
}
