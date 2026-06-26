export type ScannedContact = {
  nome?: string;
  cargo?: string;
  telefone?: string;
  email?: string;
  tipo?: string;
  origem?: string;
  foco?: string; // frente de busca que encontrou (Gabinete, Ouvidoria, Educação, Saúde…)
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

// Pool de chaves: uma por frente (round-robin). Várias em GROQ_API_KEYS (separadas por
// vírgula) ou cai na única GROQ_API_KEY. As chaves ficam SÓ em variável de ambiente —
// nunca no código/repo.
function groqKeys(): string[] {
  const multi = (process.env.GROQ_API_KEYS || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (multi.length) return multi;
  const single = (process.env.GROQ_API_KEY || "").trim();
  return single ? [single] : [];
}

// As 4 frentes de busca: cada uma é uma ESTRATÉGIA diferente de achar contato,
// e nenhuma pode devolver o número atual (que está incorreto).
type ScanFocus = { foco: string; instrucao: string; tipo: string };
const SCAN_FOCI: ScanFocus[] = [
  {
    foco: "Telefones oficiais da prefeitura/órgão",
    instrucao:
      "Procure telefones oficiais da prefeitura/órgão em fontes variadas (site oficial, página de contato, portal da transparência, diário oficial, câmara municipal). Devem ser DIFERENTES do telefone atual conhecido — ele está INCORRETO.",
    tipo: "geral",
  },
  {
    foco: "Ouvidoria",
    instrucao:
      "Procure contatos da OUVIDORIA da cidade/órgão (ouvidoria municipal, SIC — Serviço de Informação ao Cidadão, atendimento ao cidadão).",
    tipo: "ouvidoria",
  },
  {
    foco: "Pessoas da gestão",
    instrucao:
      "Procure contatos de PESSOAS ligadas à gestão da cidade/órgão: prefeito(a), vice, secretários(as), chefe de gabinete, diretores ou servidores que trabalham no órgão, com telefone público.",
    tipo: "pessoa",
  },
  {
    foco: "Varredura geral",
    instrucao:
      "Faça uma varredura GERAL por qualquer contato público possível: redes sociais (Instagram, Facebook), Wikipédia, notícias, listas e qualquer página pública relacionada à cidade/órgão.",
    tipo: "outro",
  },
];

function focusPrompt(org: OrgInput, f: ScanFocus): string {
  return `Você faz UMA frente de busca de contatos públicos do município/órgão abaixo.

Cidade: ${org.cidade || ""}
Estado: ${org.estado || ""}
Prefeito(a): ${org.nomePrefeito || ""}
Site oficial conhecido: ${org.siteOficial || ""}
Telefone atual conhecido (INCORRETO — NÃO repita este número): ${org.telefonePrefeitura || ""}

FRENTE: ${f.foco}
${f.instrucao}
Traga de 2 a 3 contatos (no máximo 3), com telefone completo com DDD.

Retorne apenas JSON no formato:
[{"nome":"...","cargo":"...","telefone":"...","email":"...","tipo":"${f.tipo}","origem":"URL ou descrição da fonte"}]

Não invente telefone — só retorne quando houver fonte pública. NÃO devolva o telefone atual conhecido (está incorreto).
Retorne só resultados com telefone completo com DDD; sem DDD, não inclua o resultado.
Não conclua que o contato "não existe" por ligação não atendida, ocupado, caixa postal ou fonte fora do ar.
Se a fonte indicar que o contato existe mas o telefone estiver incerto, deixe o telefone vazio em vez de inventar.
Se não encontrar algum campo, use string vazia. Não escreva nada além do JSON.`;
}

// Uma frente: 1 chamada à Groq (com 1 retry em 429). Lança erro em caso de falha.
async function runScanAgent(key: string, model: string, prompt: string): Promise<ScannedContact[]> {
  const requestInit: RequestInit = {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Você busca contatos públicos de órgãos e responde somente JSON válido." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  };
  const call = () => fetch("https://api.groq.com/openai/v1/chat/completions", requestInit);
  let res = await call();
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 4000));
    res = await call();
  }
  if (!res.ok) throw new Error(groqErrorMessage(res.status, await res.text().catch(() => "")));
  const data = await res.json();
  const content = String(data?.choices?.[0]?.message?.content || "");
  return normalizeContacts(extractJson(content));
}

export async function scanOrgContacts(org: OrgInput): Promise<ScanResult> {
  const keys = groqKeys();
  if (!keys.length) return { ok: false, error: "GROQ_API_KEYS (ou GROQ_API_KEY) não configurada." };
  const model = process.env.GROQ_MODEL || "groq/compound-mini";

  // Uma frente por foco, em paralelo; cada frente usa uma chave do pool (round-robin)
  // para não estourar o limite de uma chave só.
  const settled = await Promise.allSettled(
    SCAN_FOCI.map((f, i) =>
      runScanAgent(keys[i % keys.length], model, focusPrompt(org, f)).then((cs) =>
        cs.slice(0, 3).map((c) => ({ ...c, foco: f.foco }))
      )
    )
  );

  const encontrados: ScannedContact[] = [];
  let algumOk = false;
  let primeiroErro = "";
  for (const s of settled) {
    if (s.status === "fulfilled") {
      algumOk = true;
      encontrados.push(...s.value);
    } else if (!primeiroErro) {
      primeiroErro = String((s.reason as Error)?.message || s.reason);
    }
  }
  if (!algumOk) return { ok: false, error: primeiroErro || "Não foi possível concluir a varredura agora." };

  // Descarta o número atual (incorreto) e deduplica por telefone (mantém o 1º a achar).
  const atual = comparablePhone(org.telefonePrefeitura);
  const seen = new Set<string>();
  const unicos = encontrados.filter((c) => {
    const k = comparablePhone(c.telefone);
    if (!k || k === atual || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const contatos = await validateScannedContacts(unicos, org);
  return {
    ok: true,
    contatos,
    resumo: contatos.length
      ? `${contatos.length} contato(s) em ${SCAN_FOCI.length} frentes (prefeitura, ouvidoria, gestão e busca geral).`
      : "Nenhum contato retornado.",
  };
}
