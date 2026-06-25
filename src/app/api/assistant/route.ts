import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { isAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Viewer = { id: string; role: string; name: string | null };

const LDRS = ["Cecília", "Karina"] as const; // usado apenas no modo admin (visão geral)
const SENSITIVE_TERMS = ["token", "senha", "password", "hash", "secret", "api key", "apikey", ".env", "groq_api_key"];

type AdminContext = Awaited<ReturnType<typeof buildAdminContext>>;
type SelfContext = Awaited<ReturnType<typeof buildSelfContext>>;

function normalizeName(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesLdr(ldr: string, ...values: Array<string | null | undefined>) {
  const needle = normalizeName(ldr);
  return values.some((value) => normalizeName(value).includes(needle));
}

function dayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function safeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((message): ChatMessage => {
      const role: ChatMessage["role"] = message?.role === "assistant" ? "assistant" : "user";
      return {
        role,
        content: String(message?.content || "").slice(0, 1200),
      };
    })
    .filter((message) => message.content.trim())
    .slice(-8);
}

function asksForSensitiveData(text: string) {
  const normalized = normalizeName(text);
  return SENSITIVE_TERMS.some((term) => normalized.includes(term));
}

// Privacidade do LDR: bloqueia perguntas sobre OUTROS usuários / a equipe / cargos alheios.
// (Defesa adicional — o contexto do LDR já não contém esses dados.)
function asksAboutOtherUsers(text: string, viewer: Viewer) {
  const n = normalizeName(text);
  if (/\busuari/.test(n)) return true; // "usuário(s)"
  if (/(quem|quantos|quantas|quais|lista|liste)\b/.test(n) && /(usuari|ldr|admin|cargo|equipe|time|pessoa|funcionari|colaborador)/.test(n)) return true;
  if (/(e-?mail|cargo|senha|telefone|numero|contato)\s+(de|do|da|dos|das)\s+\S/.test(n)) return true;
  // citou outro LDR conhecido que não é ele mesmo
  if (LDRS.some((l) => n.includes(normalizeName(l)) && normalizeName(l) !== normalizeName(viewer.name))) return true;
  return false;
}

function searchTerms(question: string) {
  const ignored = new Set([
    "quais", "qual", "quantos", "quantas", "contatos", "contato", "telefone", "telefones",
    "numero", "numeros", "número", "números", "hoje", "ontem", "essa", "esse", "sistema",
    "meus", "minhas", "meu", "minha",
  ]);

  return normalizeName(question)
    .split(/[^a-z0-9]+/g)
    .filter((term) => term.length >= 3 && !ignored.has(term))
    .slice(0, 8);
}

function contactMatchesTerms(
  terms: string[],
  contact: {
    cidade: string | null;
    estado: string | null;
    status: string;
    campanha: string | null;
    prospectante?: string | null;
    proprietario?: string | null;
  },
) {
  if (!terms.length) return false;
  const haystack = normalizeName(
    [contact.cidade, contact.estado, contact.status, contact.campanha, contact.prospectante, contact.proprietario]
      .filter(Boolean)
      .join(" "),
  );
  return terms.some((term) => haystack.includes(term));
}

function formatDateTime(value: Date | string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------- Modo LDR: só os PRÓPRIOS números + geral da SASI ----------------

async function buildSelfContext(question: string, viewer: Viewer) {
  const { start, end } = dayBounds();

  const [bases, contatos, pendentes, atualizados, meusContatos, meusContatosHoje, minhasResolvidas, minhasResolvidasHoje, minhasRecentes, meusContatosLista, meusMexidosHoje] = await Promise.all([
    prisma.base.count(),
    prisma.contact.count({ where: { deletedAt: null } }),
    prisma.correction.count({ where: { status: "pending" } }),
    prisma.contact.count({ where: { status: "telefone_atualizado", deletedAt: null } }),
    prisma.contact.count({ where: { deletedAt: null, createdById: viewer.id } }),
    prisma.contact.count({ where: { deletedAt: null, createdById: viewer.id, createdAt: { gte: start, lt: end } } }),
    prisma.correction.count({ where: { status: "resolved", resolvedById: viewer.id } }),
    prisma.correction.count({ where: { status: "resolved", resolvedById: viewer.id, resolvedAt: { gte: start, lt: end } } }),
    prisma.correction.findMany({
      where: { status: "resolved", resolvedById: viewer.id, newValue: { not: null } },
      select: { oldValue: true, newValue: true, resolvedAt: true, contact: { select: { cidade: true, estado: true, campanha: true } } },
      orderBy: { resolvedAt: "desc" }, take: 25,
    }),
    prisma.contact.findMany({
      where: { deletedAt: null, createdById: viewer.id },
      select: { cidade: true, estado: true, telefonePrefeitura: true, status: true, campanha: true, createdAt: true },
      orderBy: { createdAt: "desc" }, take: 300,
    }),
    prisma.correction.findMany({
      where: { status: "resolved", resolvedById: viewer.id, resolvedAt: { gte: start, lt: end }, newValue: { not: null } },
      select: { oldValue: true, newValue: true, resolvedAt: true, contact: { select: { cidade: true, estado: true } } },
      orderBy: { resolvedAt: "desc" }, take: 40,
    }),
  ]);

  const terms = searchTerms(question);
  const encontrados = meusContatosLista
    .filter((c) => contactMatchesTerms(terms, c))
    .slice(0, 20)
    .map((c) => ({ cidade: c.cidade, estado: c.estado, telefone: c.telefonePrefeitura, status: c.status, campanha: c.campanha, criadoEm: c.createdAt }));

  return {
    geradoEm: new Date().toISOString(),
    seguranca:
      "Acesso de LDR: este contexto contém SOMENTE os números do próprio usuário e dados gerais da SASI. Não há dados de outros usuários, e-mails, cargos nem atividade de outros LDRs.",
    voce: { nome: viewer.name, cargo: "LDR" },
    geralDaSasi: { bases, contatos, telefonesPendentesNaFila: pendentes, telefonesAtualizados: atualizados },
    seusNumeros: {
      contatosAdicionados: meusContatos,
      contatosAdicionadosHoje: meusContatosHoje,
      numerosAtualizados: minhasResolvidas,
      numerosAtualizadosHoje: minhasResolvidasHoje,
      seusContatosMexidosHoje: meusMexidosHoje.map((c) => ({ cidade: c.contact.cidade, estado: c.contact.estado, telefoneAntigo: c.oldValue, telefoneNovo: c.newValue, data: c.resolvedAt })),
      suasCorrecoesRecentes: minhasRecentes.map((c) => ({ cidade: c.contact.cidade, estado: c.contact.estado, campanha: c.contact.campanha, telefoneAntigo: c.oldValue, telefoneNovo: c.newValue, resolvidoEm: c.resolvedAt })),
    },
    seusContatosEncontradosPorTermos: encontrados,
  };
}

function selfLocalAnswer(question: string, ctx: SelfContext): string | null {
  const n = normalizeName(question);
  const hoje = n.includes("hoje");
  const sobreMim = /\b(mexi|fiz|meus|minhas|meu|minha|eu)\b/.test(n) || n.includes("atualiz") || n.includes("corrig") || n.includes("adicion");

  if (sobreMim) {
    const s = ctx.seusNumeros;
    if (hoje) {
      return `Hoje você adicionou ${s.contatosAdicionadosHoje} contato(s) e atualizou ${s.numerosAtualizadosHoje} número(s).`;
    }
    return `Seus números no total: ${s.contatosAdicionados} contato(s) adicionados e ${s.numerosAtualizados} número(s) atualizados.`;
  }

  if (n.includes("base") || n.includes("pendente") || n.includes("fila") || n.includes("geral")) {
    const g = ctx.geralDaSasi;
    return `Geral da SASI: ${g.bases} base(s), ${g.contatos} contato(s), ${g.telefonesPendentesNaFila} na fila de correção e ${g.telefonesAtualizados} telefone(s) atualizado(s).`;
  }

  return null;
}

// ---------------- Modo ADMIN: visão geral completa ----------------

function localAnswer(question: string, context: AdminContext) {
  const normalized = normalizeName(question);
  const requestedLdr = LDRS.find((ldr) => normalized.includes(normalizeName(ldr)));
  const asksToday = normalized.includes("hoje");
  const asksPending = normalized.includes("pendente") || normalized.includes("fila") || normalized.includes("corrigir");
  const asksUpdated = normalized.includes("atualiz") || normalized.includes("corrig");
  const asksAdded = normalized.includes("adicion") || normalized.includes("criad") || normalized.includes("novo");

  if (requestedLdr) {
    const metrics = context.ldrs.find((ldr) => ldr.ldr === requestedLdr);
    if (!metrics) return null;

    const touched = asksToday ? metrics.contatosMexidosHoje : [];
    const lines = touched.slice(0, 12).map((item) => {
      const local = [item.cidade, item.estado].filter(Boolean).join("/");
      if (item.tipo === "telefone atualizado") {
        return `- ${local}: telefone atualizado de ${item.telefoneAntigo || "sem registro"} para ${item.telefoneNovo || "sem registro"} em ${formatDateTime(item.data)}.`;
      }
      return `- ${local}: contato adicionado com telefone ${item.telefone || "sem telefone"} em ${formatDateTime(item.data)}.`;
    });

    if (asksToday) {
      return [
        `${requestedLdr} mexeu em ${metrics.contatosMexidosHoje.length} contato(s) hoje.`,
        `Hoje: ${metrics.contatosAdicionadosHoje} adicionado(s), ${metrics.numerosAtualizadosHoje} número(s) atualizado(s).`,
        lines.length ? lines.join("\n") : "Não encontrei contatos mexidos hoje para essa LDR nos dados disponíveis.",
      ].join("\n\n");
    }

    return `${requestedLdr}: ${metrics.contatosAdicionados} contato(s) adicionados, ${metrics.numerosAtualizados} número(s) atualizado(s) e ${metrics.pendentes} pendente(s).`;
  }

  if (asksPending) {
    return `Há ${context.totais.telefonesPendentes} telefone(s) pendente(s) na fila. Por LDR: ${context.ldrs
      .map((ldr) => `${ldr.ldr}: ${ldr.pendentes}`)
      .join(", ")}.`;
  }

  if (asksUpdated) {
    return `Há ${context.totais.telefonesAtualizados} telefone(s) atualizado(s). Por LDR: ${context.ldrs
      .map((ldr) => `${ldr.ldr}: ${ldr.numerosAtualizados}`)
      .join(", ")}.`;
  }

  if (asksAdded) {
    return `Há ${context.totais.contatos} contato(s) ativos. Por LDR: ${context.ldrs
      .map((ldr) => `${ldr.ldr}: ${ldr.contatosAdicionados}`)
      .join(", ")}.`;
  }

  return null;
}

function compactContextForGroq(context: AdminContext) {
  return {
    geradoEm: context.geradoEm,
    seguranca: context.seguranca,
    totais: context.totais,
    usuarios: context.usuarios,
    ldrs: context.ldrs.map((ldr) => ({
      ldr: ldr.ldr,
      contatosAdicionados: ldr.contatosAdicionados,
      contatosAdicionadosHoje: ldr.contatosAdicionadosHoje,
      numerosAtualizados: ldr.numerosAtualizados,
      numerosAtualizadosHoje: ldr.numerosAtualizadosHoje,
      pendentes: ldr.pendentes,
      contatosMexidosHoje: ldr.contatosMexidosHoje.slice(0, 8),
    })),
    contatosEncontradosPorTermosDaPergunta: context.contatosEncontradosPorTermosDaPergunta.slice(0, 8),
    correcoesResolvidasRecentes: context.correcoesResolvidasRecentes.slice(0, 6),
    filaPendenteRecente: context.filaPendenteRecente.slice(0, 6),
  };
}

async function buildAdminContext(question: string) {
  const { start, end } = dayBounds();

  const [
    baseCount,
    contactCount,
    pendingCount,
    updatedCount,
    users,
    contacts,
    resolvedCorrections,
    pendingCorrections,
    todayCorrections,
    todayContacts,
  ] = await Promise.all([
    prisma.base.count(),
    prisma.contact.count({ where: { deletedAt: null } }),
    prisma.correction.count({ where: { status: "pending" } }),
    prisma.contact.count({ where: { status: "telefone_atualizado", deletedAt: null } }),
    prisma.user.findMany({ select: { name: true, email: true, role: true, createdAt: true } }),
    prisma.contact.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        cidade: true,
        estado: true,
        telefonePrefeitura: true,
        status: true,
        campanha: true,
        prospectante: true,
        proprietario: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 2500,
    }),
    prisma.correction.findMany({
      where: { status: "resolved", newValue: { not: null }, resolvedAt: { not: null } },
      select: {
        id: true,
        oldValue: true,
        newValue: true,
        resolvedAt: true,
        resolvedBy: { select: { name: true, email: true } },
        contact: { select: { cidade: true, estado: true, campanha: true, prospectante: true, proprietario: true } },
      },
      orderBy: { resolvedAt: "desc" },
      take: 500,
    }),
    prisma.correction.findMany({
      where: { status: "pending" },
      select: {
        id: true,
        oldValue: true,
        createdAt: true,
        reason: true,
        contact: { select: { cidade: true, estado: true, campanha: true, prospectante: true, proprietario: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.correction.findMany({
      where: { status: "resolved", resolvedAt: { gte: start, lt: end }, newValue: { not: null } },
      select: {
        oldValue: true,
        newValue: true,
        resolvedAt: true,
        resolvedBy: { select: { name: true, email: true } },
        contact: { select: { cidade: true, estado: true, prospectante: true, proprietario: true } },
      },
      orderBy: { resolvedAt: "desc" },
      take: 100,
    }),
    prisma.contact.findMany({
      where: { deletedAt: null, createdAt: { gte: start, lt: end } },
      select: {
        cidade: true,
        estado: true,
        telefonePrefeitura: true,
        status: true,
        prospectante: true,
        proprietario: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const ldrMetrics = LDRS.map((ldr) => {
    const added = contacts.filter((contact) =>
      matchesLdr(ldr, contact.createdBy?.name, contact.createdBy?.email, contact.prospectante, contact.proprietario),
    );
    const updated = resolvedCorrections.filter((correction) =>
      matchesLdr(ldr, correction.resolvedBy?.name, correction.resolvedBy?.email, correction.contact.prospectante, correction.contact.proprietario),
    );
    const pending = pendingCorrections.filter((correction) =>
      matchesLdr(ldr, correction.contact.prospectante, correction.contact.proprietario),
    );
    const updatedToday = todayCorrections.filter((correction) =>
      matchesLdr(ldr, correction.resolvedBy?.name, correction.resolvedBy?.email, correction.contact.prospectante, correction.contact.proprietario),
    );
    const addedToday = todayContacts.filter((contact) =>
      matchesLdr(ldr, contact.createdBy?.name, contact.createdBy?.email, contact.prospectante, contact.proprietario),
    );

    return {
      ldr,
      contatosAdicionados: added.length,
      contatosAdicionadosHoje: addedToday.length,
      numerosAtualizados: updated.length,
      numerosAtualizadosHoje: updatedToday.length,
      pendentes: pending.length,
      contatosMexidosHoje: [
        ...addedToday.map((contact) => ({
          tipo: "contato adicionado" as const,
          cidade: contact.cidade,
          estado: contact.estado,
          telefone: contact.telefonePrefeitura,
          status: contact.status,
          data: contact.createdAt,
        })),
        ...updatedToday.map((correction) => ({
          tipo: "telefone atualizado" as const,
          cidade: correction.contact.cidade,
          estado: correction.contact.estado,
          telefoneAntigo: correction.oldValue,
          telefoneNovo: correction.newValue,
          data: correction.resolvedAt,
        })),
      ].slice(0, 40),
    };
  });

  const terms = searchTerms(question);
  const contatosEncontrados = contacts
    .filter((contact) => contactMatchesTerms(terms, contact))
    .slice(0, 120)
    .map((contact) => ({
      cidade: contact.cidade,
      estado: contact.estado,
      telefone: contact.telefonePrefeitura,
      status: contact.status,
      campanha: contact.campanha,
      prospectante: contact.prospectante,
      proprietario: contact.proprietario,
      criadoPor: contact.createdBy?.name || contact.createdBy?.email || null,
      criadoEm: contact.createdAt,
    }));

  return {
    geradoEm: new Date().toISOString(),
    seguranca:
      "Contexto sem tokens, senhas, hashes, variáveis de ambiente, chaves de API ou credenciais. O agente é somente leitura.",
    totais: {
      bases: baseCount,
      contatos: contactCount,
      telefonesPendentes: pendingCount,
      telefonesAtualizados: updatedCount,
      usuarios: users.length,
    },
    usuarios: users.map((user) => ({ nome: user.name, email: user.email, cargo: user.role, criadoEm: user.createdAt })),
    ldrs: ldrMetrics,
    contatosEncontradosPorTermosDaPergunta: contatosEncontrados.slice(0, 20),
    correcoesResolvidasRecentes: resolvedCorrections.slice(0, 20).map((correction) => ({
      cidade: correction.contact.cidade,
      estado: correction.contact.estado,
      campanha: correction.contact.campanha,
      ldrOuResponsavel: correction.resolvedBy?.name || correction.contact.proprietario || correction.contact.prospectante,
      telefoneAntigo: correction.oldValue,
      telefoneNovo: correction.newValue,
      resolvidoEm: correction.resolvedAt,
    })),
    filaPendenteRecente: pendingCorrections.slice(0, 20).map((correction) => ({
      cidade: correction.contact.cidade,
      estado: correction.contact.estado,
      campanha: correction.contact.campanha,
      responsavel: correction.contact.proprietario || correction.contact.prospectante,
      telefone: correction.oldValue,
      motivo: correction.reason,
      criadoEm: correction.createdAt,
    })),
  };
}

const ADMIN_PROMPT =
  "Você é o agente interno do SASI LDR Hub (visão de administrador). Responda em português do Brasil, de forma objetiva. Use somente o contexto JSON fornecido. Você é somente leitura. Nunca revele, invente ou peça tokens, senhas, hashes, variáveis de ambiente, chaves de API ou credenciais. Se os dados não estiverem no contexto, diga que não encontrou nos dados disponíveis.";

const LDR_PROMPT =
  "Você é o agente interno do SASI LDR Hub atendendo um usuário de cargo LDR. Responda em português do Brasil, objetivo, usando SOMENTE o contexto JSON fornecido. Você é somente leitura. REGRAS DE PRIVACIDADE (obrigatórias): o LDR só pode ver os PRÓPRIOS números (campos 'voce' e 'seusNumeros') e dados gerais da SASI (campo 'geralDaSasi'). NUNCA revele, liste, conte ou estime dados de OUTROS usuários: nomes, e-mails, cargos, quantidade de usuários, ou a atividade/produtividade de outros LDRs — esses dados NÃO estão no contexto. Se perguntarem sobre outros usuários, a lista de usuários, quem tem determinado cargo, ou os números de outra pessoa, responda que esse tipo de informação não está disponível para o acesso de LDR. Nunca revele tokens, senhas, hashes, variáveis de ambiente, chaves de API ou credenciais.";

export async function POST(req: Request) {
  const { session, deny } = await requireUser();
  if (deny) return deny;

  const u = (session.user || {}) as { id?: string; role?: string; name?: string | null };
  const viewer: Viewer = { id: u.id || "", role: u.role || "user", name: u.name || null };
  const admin = isAdmin(viewer.role);

  const body = await req.json().catch(() => ({}));
  const messages = safeMessages(body?.messages);
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content || "";

  if (!lastUserMessage.trim()) {
    return NextResponse.json({ error: "Digite uma pergunta para o agente." }, { status: 400 });
  }

  if (asksForSensitiveData(lastUserMessage)) {
    return NextResponse.json({
      answer: "Não posso acessar ou revelar tokens, senhas, hashes, chaves de API, variáveis de ambiente ou credenciais.",
    });
  }

  // Bloqueio de privacidade para LDR: nada sobre outros usuários.
  if (!admin && asksAboutOtherUsers(lastUserMessage, viewer)) {
    return NextResponse.json({
      answer:
        "Como LDR, você tem acesso apenas aos seus próprios números e a informações gerais da SASI. Dados de outros usuários (lista, e-mails, cargos ou atividade) não estão disponíveis para o seu acesso.",
      source: "policy",
    });
  }

  const apiKey = process.env.GROQ_API_KEY;

  let fallbackAnswer: string | null;
  let groqContext: unknown;
  let systemPolicy: string;

  if (admin) {
    const context = await buildAdminContext(lastUserMessage);
    fallbackAnswer = localAnswer(lastUserMessage, context);
    groqContext = compactContextForGroq(context);
    systemPolicy = ADMIN_PROMPT;
  } else {
    const context = await buildSelfContext(lastUserMessage, viewer);
    fallbackAnswer = selfLocalAnswer(lastUserMessage, context);
    groqContext = context;
    systemPolicy = LDR_PROMPT;
  }

  if (!apiKey) {
    return NextResponse.json({
      answer:
        fallbackAnswer ||
        "Consigo consultar alguns indicadores locais, mas para respostas abertas configure GROQ_API_KEY no servidor.",
      source: "local",
    });
  }

  const model = process.env.GROQ_MODEL || "groq/compound-mini";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        { role: "system", content: systemPolicy },
        { role: "system", content: `Contexto seguro do sistema:\n${JSON.stringify(groqContext)}` },
        ...messages.map((message) => ({ role: message.role, content: message.content })),
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (fallbackAnswer) {
      return NextResponse.json({
        answer: fallbackAnswer,
        source: "local",
        groq: { ok: false, error: data?.error?.message || `Groq retornou HTTP ${response.status}.` },
      });
    }
    return NextResponse.json({
      answer: "Não consegui consultar o Groq agora e não encontrei uma resposta local segura para essa pergunta.",
      source: "local",
      groq: { ok: false, error: data?.error?.message || `Groq retornou HTTP ${response.status}.` },
    });
  }

  return NextResponse.json({
    answer: data?.choices?.[0]?.message?.content || "Não encontrei uma resposta nos dados disponíveis.",
    source: "groq",
    model,
  });
}
