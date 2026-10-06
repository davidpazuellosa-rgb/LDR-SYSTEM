import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { ensureContactCustomTable } from "@/lib/custom-columns";
import { atualizarConclusao } from "@/lib/contact-fill";
import { parseCustomCols } from "@/lib/base-columns";
import { valorValidoNaLista } from "@/lib/coluna-lista";
import { isRowVazia } from "@/lib/completude";
import { ehColunaValidacao, validacaoAtiva, valorDeValidacao, valorGravado } from "@/lib/validacao";
import { ensureContactValidacaoTable } from "@/lib/validacao-db";

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
  const contato = await prisma.contact.findUnique({ where: { id }, select: { base: { select: { headers: true } } } });
  const headers = contato?.base.headers as Record<string, unknown> | null;
  const col = parseCustomCols(headers).find((c) => c.key === colKey);
  if (valor && valor.trim() && col?.tipo === "lista" && !valorValidoNaLista(col.opcoes, valor)) {
    return NextResponse.json({ error: "Valor fora da lista dessa coluna." }, { status: 400 });
  }

  // Coluna de VALIDAÇÃO: registra quem validou (1 crédito por contato, de quem registrou
  // por último). "–" ou vazio = ainda não validado: apaga o registro. O "–" nunca é gravado.
  if (ehColunaValidacao(col)) {
    if (!validacaoAtiva(headers)) return NextResponse.json({ error: "A validação está desligada nesta planilha." }, { status: 400 });
    const v = valorDeValidacao(valor);
    if (v) {
      // Linha totalmente vazia não pode ser validada (a coluna de validação não conta como dado).
      const [linha, outros] = await Promise.all([
        prisma.contact.findUnique({ where: { id } }),
        prisma.contactCustomValue.findMany({ where: { contactId: id, NOT: { colKey } }, select: { colKey: true, valor: true } }),
      ]);
      const custom = Object.fromEntries(outros.map((o) => [o.colKey, o.valor ?? ""]));
      if (!linha || isRowVazia(linha as unknown as Record<string, unknown>, custom)) {
        return NextResponse.json({ error: "Preencha algum dado da linha antes de validar." }, { status: 400 });
      }
    }
    await Promise.all([ensureContactCustomTable(), ensureContactValidacaoTable()]);
    const gravado = valorGravado(v);
    await prisma.$transaction([
      prisma.contactCustomValue.upsert({
        where: { contactId_colKey: { contactId: id, colKey } },
        create: { contactId: id, colKey, valor: gravado },
        update: { valor: gravado },
      }),
      v
        ? prisma.contactValidacao.upsert({
            where: { contactId: id },
            create: { contactId: id, valor: v, porId: meId },
            update: { valor: v, porId: meId, em: new Date() },
          })
        : prisma.contactValidacao.deleteMany({ where: { contactId: id } }),
    ]);
    return NextResponse.json({ ok: true, valor: gravado ?? "" });
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
