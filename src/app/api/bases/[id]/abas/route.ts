import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { ufSigla } from "@/lib/uf";
import { ABAS_KEY, parseAbas } from "@/lib/base-abas";
import { criarLinhasVazias } from "@/lib/linhas-iniciais";
import { LINHAS_INICIAIS, isRowVazia } from "@/lib/completude";

export const dynamic = "force-dynamic";

// Páginas (abas) da planilha, uma por estado. Guardadas em headers.__abas__ para
// existirem mesmo sem nenhuma linha ainda. Mesmo acesso de /layout e /ordenar:
// qualquer usuário logado altera.

async function lerBase(id: string) {
  const base = await prisma.base.findUnique({ where: { id }, select: { headers: true } });
  if (!base) return null;
  return ((base.headers as Record<string, unknown> | null) || {}) as Record<string, unknown>;
}

// Merge no headers existente — salvar abas não pode apagar colunas/ordem/mesclas.
async function salvarAbas(id: string, headers: Record<string, unknown>, abas: string[]) {
  await prisma.base.update({
    where: { id },
    data: { headers: { ...headers, [ABAS_KEY]: abas } as Prisma.InputJsonValue },
  });
}

// Cria a página de uma UF e já a preenche com linhas em branco (senão ela abriria
// vazia, que é justamente o problema que este recurso resolve).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, deny } = await requireUser();
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const uf = ufSigla(String(body?.uf || ""));
  if (!uf) return NextResponse.json({ error: "UF inválida" }, { status: 400 });

  const headers = await lerBase(id);
  if (!headers) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });

  const abas = parseAbas(headers);
  const jaExiste = abas.includes(uf);

  // Já tem linha nessa UF? Então a aba já aparecia (derivada) — só persiste,
  // sem criar linha nova em cima do que já existe.
  const comDado = await prisma.contact.count({ where: { baseId: id, deletedAt: null, estado: uf } });

  const criadas =
    comDado > 0
      ? []
      : await criarLinhasVazias(id, LINHAS_INICIAIS, {
          estado: uf,
          regiao: body?.regiao ? String(body.regiao) : null,
          // @ts-expect-error id custom na sessão
          createdById: session.user.id ?? null,
        });

  if (!jaExiste) await salvarAbas(id, headers, [...abas, uf]);

  return NextResponse.json({ ok: true, uf, criadas });
}

// Remove a página. Só deixa se não houver nenhuma linha COM DADO naquela UF —
// apagar página com conteúdo tem que ser explícito (excluir as linhas antes).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { deny } = await requireUser();
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const uf = ufSigla(String(body?.uf || ""));
  if (!uf) return NextResponse.json({ error: "UF inválida" }, { status: 400 });

  const headers = await lerBase(id);
  if (!headers) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });

  const linhas = await prisma.contact.findMany({ where: { baseId: id, deletedAt: null, estado: uf } });
  const valores = linhas.length
    ? await prisma.contactCustomValue.findMany({
        where: { contactId: { in: linhas.map((c) => c.id) } },
        select: { contactId: true, colKey: true, valor: true },
      })
    : [];
  const porContato: Record<string, Record<string, string>> = {};
  for (const v of valores) (porContato[v.contactId] ||= {})[v.colKey] = v.valor ?? "";

  const comDado = linhas.filter(
    (c) => !isRowVazia(c as unknown as Record<string, unknown>, porContato[c.id])
  );
  if (comDado.length > 0) {
    return NextResponse.json(
      { error: `A página ${uf} tem ${comDado.length} linha(s) preenchida(s). Exclua as linhas antes.` },
      { status: 409 }
    );
  }

  // Sem dado: tira a aba e leva junto as linhas em branco dela (soft delete).
  if (linhas.length) {
    await prisma.contact.updateMany({
      where: { id: { in: linhas.map((c) => c.id) } },
      data: { deletedAt: new Date() },
    });
  }
  await salvarAbas(
    id,
    headers,
    parseAbas(headers).filter((a) => a !== uf)
  );

  return NextResponse.json({ ok: true, uf, removidas: linhas.length });
}
