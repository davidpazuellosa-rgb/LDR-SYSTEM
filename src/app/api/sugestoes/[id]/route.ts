import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { ensureSuggestionTable } from "@/lib/suggestions";

export const dynamic = "force-dynamic";

// Só admin muda o status (marcar como resolvida / reabrir).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { deny } = await requireAdmin();
  if (deny) return deny;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body?.status === "resolvida" ? "resolvida" : "nova";
  await ensureSuggestionTable();
  await prisma.suggestion.update({ where: { id }, data: { status } });
  return NextResponse.json({ ok: true });
}
