import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LINHAS_INICIAIS } from "@/lib/completude";
import { SEMEADA_KEY, foiSemeada } from "@/lib/base-abas";

// Cria N linhas em branco numa base. Só `baseId` é obrigatório no banco — todo o
// resto fica null, igual ao que POST /api/contacts já faz para uma linha só.
// `estado`/`regiao` são o andaime da página em que a linha nasce (não contam como
// dado preenchido — ver isRowVazia em completude.ts).
export async function criarLinhasVazias(
  baseId: string,
  quantidade: number,
  opts: { estado?: string | null; regiao?: string | null; createdById?: string | null } = {}
) {
  const n = Math.max(0, Math.min(500, Math.trunc(quantidade)));
  if (n === 0) return [];
  const data = {
    baseId,
    createdById: opts.createdById ?? null,
    estado: opts.estado || null,
    regiao: opts.regiao || null,
  };
  // $transaction de create()s (e não createMany) porque a grade precisa dos ids
  // de volta pra inserir as linhas na tela — mesmo padrão da importação.
  return prisma.$transaction(Array.from({ length: n }, () => prisma.contact.create({ data })));
}

// Planilha nova (ou que ainda está vazia) abre já com linhas em branco, em vez de
// "Nenhum contato". Roda uma única vez por base, marcada em headers.__semeada__.
export async function garantirLinhasIniciais(
  baseId: string,
  opts: { regiao?: string | null; createdById?: string | null } = {}
) {
  const base = await prisma.base.findUnique({ where: { id: baseId }, select: { headers: true } });
  if (!base) return;
  const headers = ((base.headers as Record<string, unknown> | null) || {}) as Record<string, unknown>;
  if (foiSemeada(headers)) return;

  const existentes = await prisma.contact.count({ where: { baseId, deletedAt: null } });
  if (existentes > 0) {
    // Base já tem conteúdo: só marca como semeada pra nunca mais checar.
    await marcarSemeada(baseId, headers);
    return;
  }

  await criarLinhasVazias(baseId, LINHAS_INICIAIS, {
    regiao: opts.regiao ?? null,
    createdById: opts.createdById ?? null,
  });
  await marcarSemeada(baseId, headers);
}

// Merge no headers existente (nunca sobrescreve) — igual a /layout e /colunas.
async function marcarSemeada(baseId: string, headers: Record<string, unknown>) {
  await prisma.base.update({
    where: { id: baseId },
    data: { headers: { ...headers, [SEMEADA_KEY]: true } as Prisma.InputJsonValue },
  });
}
