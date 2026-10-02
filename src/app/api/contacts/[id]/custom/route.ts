import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { ensureContactCustomTable } from "@/lib/custom-columns";
import { atualizarConclusao } from "@/lib/contact-fill";
import { parseCustomCols } from "@/lib/base-columns";
import { valorValidoNaLista } from "@/lib/coluna-lista";

export const dynamic = "force-dynamic";

// Valor de uma célula de coluna personalizada. Qualquer usuário logado pode preencher.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, deny } = await requireUser();
  if (deny) return deny;
  const meId = session?.user?.id || null;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const colKey = String(body?.colKey || "").slice(0, 40);
  const valor = body?.valor == null ? null : String(body.valor);
  if (!colKey) return NextResponse.json({ error: "colKey obrigatório" }, { status: 400 });

  // Coluna de lista suspensa: o servidor também recusa valor fora da lista (a tela já
  // recusa, mas a API não pode ser contornada). Vazio = limpar, sempre permitido.
  if (valor && valor.trim()) {
    const contato = await prisma.contact.findUnique({ where: { id }, select: { base: { select: { headers: true } } } });
    const col = parseCustomCols(contato?.base.headers as Record<string, unknown> | null).find((c) => c.key === colKey);
    if (col?.tipo === "lista" && !valorValidoNaLista(col.opcoes, valor)) {
      return NextResponse.json({ error: "Valor fora da lista dessa coluna." }, { status: 400 });
    }
  }

  await ensureContactCustomTable();
  await prisma.contactCustomValue.upsert({
    where: { contactId_colKey: { contactId: id, colKey } },
    create: { contactId: id, colKey, valor },
    update: { valor },
  });
  // Colunas personalizadas contam na conclusão: recalcula o crédito de preenchimento.
  await atualizarConclusao(id, meId);
  return NextResponse.json({ ok: true });
}
