import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { reprocessarConclusaoDaBase } from "@/lib/contact-fill";

export const dynamic = "force-dynamic";

const COLS_KEY = "__cols__";

// Definições das colunas personalizadas (bloco à direita) — guardadas em
// Base.headers.__cols__. Só admin altera a estrutura. Sem coluna nova no banco.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, deny } = await requireAdmin();
  if (deny) return deny;
  const meId = (session.user as { id?: string }).id || null;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const raw = Array.isArray(body?.cols) ? (body.cols as unknown[]) : null;
  if (!raw) return NextResponse.json({ error: "cols inválido" }, { status: 400 });

  const cols = raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({ key: String(c.key || "").slice(0, 40), label: String(c.label || "").trim().slice(0, 60) }))
    .filter((c) => c.key && c.label)
    .slice(0, 30);

  const base = await prisma.base.findUnique({ where: { id }, select: { headers: true } });
  if (!base) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });

  const current = ((base.headers as Record<string, unknown> | null) || {}) as Record<string, unknown>;
  await prisma.base.update({ where: { id }, data: { headers: { ...current, [COLS_KEY]: cols } } });
  // A régua mudou (coluna criada/excluída): recalcula a conclusão de todos os contatos.
  await reprocessarConclusaoDaBase(id, meId);
  return NextResponse.json({ ok: true, cols });
}
