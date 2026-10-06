import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { parseHiddenCols, parseDeletedCols, parseCustomCols } from "@/lib/base-columns";
import { ligarValidacao, desligarValidacao, validacaoAtiva } from "@/lib/validacao";

export const dynamic = "force-dynamic";

// "Validar planilha": só o admin liga/desliga. Ligar cria (ou adota) a coluna Validado;
// desligar só a oculta — valores e créditos ficam guardados e voltam ao religar.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { deny } = await requireAdmin();
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (typeof body?.ativo !== "boolean") return NextResponse.json({ error: "ativo inválido" }, { status: 400 });

  const base = await prisma.base.findUnique({ where: { id }, select: { headers: true } });
  if (!base) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });
  const atual = (base.headers as Record<string, unknown> | null) || {};

  let headers: Record<string, unknown>;
  let adotada = false;
  if (body.ativo) {
    const r = ligarValidacao(atual);
    headers = r.headers;
    adotada = r.adotada;
  } else {
    headers = desligarValidacao(atual);
  }
  await prisma.base.update({ where: { id }, data: { headers: headers as Prisma.InputJsonValue } });

  return NextResponse.json({
    ok: true,
    validar: validacaoAtiva(headers),
    adotada,
    cols: parseCustomCols(headers),
    hidden: parseHiddenCols(headers),
    deleted: parseDeletedCols(headers),
  });
}
