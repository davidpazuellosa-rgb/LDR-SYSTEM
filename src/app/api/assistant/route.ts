import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";

export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const LDRS = ["Cecília", "Karina"] as const;
const SENSITIVE_TERMS = ["token", "senha", "password", "hash", "secret", "api key", "apikey", ".env", "groq_api_key"];

type SystemContext = Awaited<ReturnType<typeof buildSystemContext>>;

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

function searchTerms(question: string) {
  const ignored = new Set([
    "quais",
    "qual",
    "quantos",
    "quantas",
    "contatos",
    "contato",
    "telefone",
    "telefones",
    "numero",
    "numeros",
    "número",
    "números",
    "hoje",
    "ontem",
    "essa",
    "esse",
    "sistema",
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
    prospectante: string | null;
    proprietario: string | null;
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

function localAnswer(question: string, context: SystemContext) {
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

function compactContextForGroq(context: SystemContext) {
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

async function buildSystemContext(question: string) {
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
        contact: {
          select: {
            cidade: true,
            estado: true,
            campanha: true,
            prospectante: true,
            proprietario: true,
          },
        },
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
        contact: {
          select: {
            cidade: true,
            estado: true,
            campanha: true,
            prospectante: true,
            proprietario: true,
          },
        },
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
      matchesLdr(
        ldr,
        correction.resolvedBy?.name,
        correction.resolvedBy?.email,
        correction.contact.prospectante,
        correction.contact.proprietario,
      ),
    );
    const pending = pendingCorrections.filter((correction) =>
      matchesLdr(ldr, correction.contact.prospectante, correction.contact.proprietario),
    );
    const updatedToday = todayCorrections.filter((correction) =>
      matchesLdr(
        ldr,
        correction.resolvedBy?.name,
        correction.resolvedBy?.email,
        correction.contact.prospectante,
        correction.contact.proprietario,
      ),
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
    usuarios: users.map((user) => ({
      nome: user.name,
      email: user.email,
      cargo: user.role,
      criadoEm: user.createdAt,
    })),
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

export async function POST(req: Request) {
  const { deny } = await requireUser();
  if (deny) return deny;

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

  const context = await buildSystemContext(lastUserMessage);
  const fallbackAnswer = localAnswer(lastUserMessage, context);
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      answer:
        fallbackAnswer ||
        "Consigo consultar alguns indicadores locais, mas para respostas abertas configure GROQ_API_KEY no servidor.",
      source: "local",
    });
  }

  const model = process.env.GROQ_MODEL || "groq/compound-mini";
  const groqContext = compactContextForGroq(context);

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
        {
          role: "system",
          content:
            "Você é o agente interno do SASI LDR Hub. Responda em português do Brasil, de forma objetiva. Use somente o contexto JSON fornecido. Você é somente leitura. Nunca revele, invente ou peça tokens, senhas, hashes, variáveis de ambiente, chaves de API ou credenciais. Se os dados não estiverem no contexto, diga que não encontrou nos dados disponíveis.",
        },
        {
          role: "system",
          content: `Contexto seguro do sistema:\n${JSON.stringify(groqContext)}`,
        },
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
