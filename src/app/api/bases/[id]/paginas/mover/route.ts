import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { ensureContactCustomTable } from "@/lib/custom-columns";
import { PAGINA_COL, parsePaginas } from "@/lib/base-abas";

export const dynamic = "force-dynamic";

// Move linhas para uma página livre (ou tira da página com nome = null). Qualquer usuário
// logado pode organizar as linhas; criar/renomear/excluir a página é só do admin.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { deny } = await requireUser();
  if (deny) return deny;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? (body.ids as unknown[]).map(String).slice(0, 5000) : [];
  const nome = body?.nome == null || body.nome === "" ? null : String(body.nome);
  if (ids.length === 0) return NextResponse.json({ error: "Nenhuma linha." }, { status: 400 });

  const base = await prisma.base.findUnique({ where: { id }, select: { headers: true } });
  if (!base) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });
  if (nome !== null && !parsePaginas(base.headers as Record<string, unknown> | null).includes(nome)) {
    return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });
  }

  await ensureContactCustomTable();
  // Só linhas DESTA base (nunca mexe em contato de outra planilha).
  const validos = (await prisma.contact.findMany({ where: { baseId: id, id: { in: ids }, deletedAt: null }, select: { id: true } })).map((c) => c.id);
  if (validos.length === 0) return NextResponse.json({ error: "Linhas não encontradas nesta planilha." }, { status: 404 });
  if (nome === null) {
    await prisma.$executeRawUnsafe(`DELETE FROM "ContactCustomValue" WHERE "contactId" = ANY($1) AND "colKey"=$2`, validos, PAGINA_COL);
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ContactCustomValue" ("contactId","colKey","valor") SELECT x, $2, $3 FROM unnest($1::text[]) AS x ON CONFLICT ("contactId","colKey") DO UPDATE SET valor = EXCLUDED.valor`,
      validos, PAGINA_COL, nome
    );
  }
  return NextResponse.json({ ok: true, movidas: validos.length, ids: validos });
}
