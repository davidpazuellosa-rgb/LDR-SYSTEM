import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";

// Marca o telefone de um contato como incorreto -> entra na fila de correção.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, deny } = await requireUser();
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = body?.reason ? String(body.reason) : "Telefone incorreto";

  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });

  // Evita duplicar correção pendente para o mesmo contato
  const existing = await prisma.correction.findFirst({
    where: { contactId: id, status: "pending" },
  });
  if (existing) {
    return NextResponse.json({ ok: true, already: true });
  }

  await prisma.$transaction([
    prisma.correction.create({
      data: {
        contactId: id,
        field: "telefonePrefeitura",
        oldValue: contact.telefonePrefeitura,
        reason,
        status: "pending",
        // @ts-expect-error id custom na sessão
        createdById: session.user.id ?? null,
      },
    }),
    prisma.contact.update({ where: { id }, data: { status: "telefone_incorreto" } }),
  ]);

  return NextResponse.json({ ok: true });
}
