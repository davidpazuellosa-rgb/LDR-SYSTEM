import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { ORDER_KEY, HIDDEN_KEY } from "@/lib/base-columns";

export const dynamic = "force-dynamic";

// Layout COMPARTILHADO das colunas: ordem (arrastar a letra) e ocultas.
// Antes isso vivia só no localStorage de cada navegador — cada pessoa via uma
// ordem diferente e a exportação não tinha como saber qual era a certa.
// Mesmo padrão de acesso de /merges e /ordenar: qualquer usuário logado altera.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { deny } = await requireUser();
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const lista = (raw: unknown) =>
    Array.isArray(raw)
      ? Array.from(new Set(raw.map((v) => String(v || "").slice(0, 40)).filter(Boolean))).slice(0, 200)
      : null;
  const order = lista(body?.order);
  const hidden = lista(body?.hidden);
  if (!order && !hidden) return NextResponse.json({ error: "order/hidden inválidos" }, { status: 400 });

  const base = await prisma.base.findUnique({ where: { id }, select: { headers: true } });
  if (!base) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });

  const current = ((base.headers as Record<string, unknown> | null) || {}) as Record<string, unknown>;
  const next = { ...current };
  // Só mexe no que veio: salvar ordem não pode apagar as ocultas, e vice-versa.
  if (order) next[ORDER_KEY] = order;
  if (hidden) next[HIDDEN_KEY] = hidden;

  await prisma.base.update({ where: { id }, data: { headers: next as Prisma.InputJsonValue } });
  return NextResponse.json({ ok: true });
}
