import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { isAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Histórico de alterações da planilha (correções já resolvidas dos contatos da base).
// Privacidade: o nome de quem alterou só aparece para admin; o LDR vê o que mudou
// e quando, sem expor outros usuários.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, deny } = await requireUser();
  if (deny) return deny;

  const { id } = await params;
  const admin = isAdmin((session.user as { role?: string }).role);

  const itens = await prisma.correction.findMany({
    where: { status: "resolved", resolvedAt: { not: null }, contact: { baseId: id } },
    select: {
      field: true,
      oldValue: true,
      newValue: true,
      resolvedAt: true,
      resolvedBy: { select: { name: true, email: true } },
      contact: { select: { cidade: true, estado: true } },
    },
    orderBy: { resolvedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    itens: itens.map((c) => ({
      cidade: c.contact.cidade,
      estado: c.contact.estado,
      campo: c.field,
      de: c.oldValue,
      para: c.newValue,
      em: c.resolvedAt,
      por: admin ? c.resolvedBy?.name || c.resolvedBy?.email || null : null,
    })),
  });
}
