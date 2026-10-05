import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { ensureContactCustomTable } from "@/lib/custom-columns";
import { criarLinhasVazias } from "@/lib/linhas-iniciais";
import { LINHAS_INICIAIS } from "@/lib/completude";
import { MAX_PAGINAS, PAGINAS_KEY, PAGINA_COL, nomePaginaValido, parsePaginas } from "@/lib/base-abas";

export const dynamic = "force-dynamic";

async function lerHeaders(id: string) {
  const base = await prisma.base.findUnique({ where: { id }, select: { headers: true } });
  if (!base) return null;
  return ((base.headers as Record<string, unknown> | null) || {}) as Record<string, unknown>;
}
async function salvarLista(id: string, headers: Record<string, unknown>, lista: string[]) {
  await prisma.base.update({ where: { id }, data: { headers: { ...headers, [PAGINAS_KEY]: lista } as Prisma.InputJsonValue } });
}

// Cria uma página LIVRE (nome qualquer) já com linhas em branco para começar, igual às
// páginas de UF. Só o admin mexe na estrutura.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, deny } = await requireAdmin();
  if (deny) return deny;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const nome = nomePaginaValido(body?.nome);
  if (!nome) return NextResponse.json({ error: "Nome inválido (1 a 40 caracteres, sem começar com __)." }, { status: 400 });

  const headers = await lerHeaders(id);
  if (!headers) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });
  const lista = parsePaginas(headers);
  if (lista.some((n) => n.toLowerCase() === nome.toLowerCase())) return NextResponse.json({ error: "Já existe uma página com esse nome." }, { status: 409 });
  if (lista.length >= MAX_PAGINAS) return NextResponse.json({ error: `Limite de ${MAX_PAGINAS} páginas.` }, { status: 400 });

  await ensureContactCustomTable();
  // @ts-expect-error id custom na sessão
  const criadas = await criarLinhasVazias(id, LINHAS_INICIAIS, { createdById: session.user.id ?? null });
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ContactCustomValue" ("contactId","colKey","valor") SELECT c.id, $2, $3 FROM "Contact" c WHERE c.id = ANY($1) ON CONFLICT ("contactId","colKey") DO UPDATE SET valor = EXCLUDED.valor`,
    criadas.map((c) => c.id), PAGINA_COL, nome
  );
  await salvarLista(id, headers, [...lista, nome]);
  return NextResponse.json({ ok: true, nome, criadas });
}

// Renomeia: troca o nome na lista e em todas as linhas que estavam nela.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { deny } = await requireAdmin();
  if (deny) return deny;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const nome = nomePaginaValido(body?.nome);
  const novo = nomePaginaValido(body?.novo);
  if (!nome || !novo) return NextResponse.json({ error: "Nome inválido." }, { status: 400 });
  const headers = await lerHeaders(id);
  if (!headers) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });
  const lista = parsePaginas(headers);
  if (!lista.includes(nome)) return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });
  if (novo.toLowerCase() !== nome.toLowerCase() && lista.some((n) => n.toLowerCase() === novo.toLowerCase())) {
    return NextResponse.json({ error: "Já existe uma página com esse nome." }, { status: 409 });
  }
  await ensureContactCustomTable();
  await prisma.$executeRawUnsafe(
    `UPDATE "ContactCustomValue" v SET valor=$3 FROM "Contact" c WHERE c.id=v."contactId" AND c."baseId"=$1 AND v."colKey"=$4 AND v.valor=$2`,
    id, nome, novo, PAGINA_COL
  );
  await salvarLista(id, headers, lista.map((n) => (n === nome ? novo : n)));
  return NextResponse.json({ ok: true, nome: novo });
}

// Exclui a página: as linhas NÃO somem — só saem dela (voltam a aparecer em "Todas").
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { deny } = await requireAdmin();
  if (deny) return deny;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const nome = nomePaginaValido(body?.nome);
  if (!nome) return NextResponse.json({ error: "Nome inválido." }, { status: 400 });
  const headers = await lerHeaders(id);
  if (!headers) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });
  await ensureContactCustomTable();
  await prisma.$executeRawUnsafe(
    `DELETE FROM "ContactCustomValue" v USING "Contact" c WHERE c.id=v."contactId" AND c."baseId"=$1 AND v."colKey"=$3 AND v.valor=$2`,
    id, nome, PAGINA_COL
  );
  await salvarLista(id, headers, parsePaginas(headers).filter((n) => n !== nome));
  return NextResponse.json({ ok: true });
}
