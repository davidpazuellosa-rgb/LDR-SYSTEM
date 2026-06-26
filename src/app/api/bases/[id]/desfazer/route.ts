import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { ensureBaseEventoTable, type EventoSnapshot } from "@/lib/base-eventos";

// Desfaz uma ação grande da base (import_merge | import_replace) usando o snapshot
// guardado no evento. Idempotente: um evento já desfeito não é desfeito de novo.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { deny } = await requirePermission("data.import");
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const eventoId = String(body?.eventoId || "").trim();
  if (!eventoId) return NextResponse.json({ error: "eventoId obrigatório" }, { status: 400 });

  await ensureBaseEventoTable();
  const evento = await prisma.baseEvento.findUnique({ where: { id: eventoId } });
  if (!evento || evento.baseId !== id) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }
  if (evento.desfeitoEm) {
    return NextResponse.json({ error: "Essa ação já foi desfeita." }, { status: 409 });
  }

  const snap = evento.snapshot as unknown as EventoSnapshot | null;
  if (!snap) return NextResponse.json({ error: "Sem dados para desfazer." }, { status: 400 });

  let restored: { contactId: string; data: Record<string, string | null> } | null = null;

  if (snap.kind === "replace") {
    // Restaura os contatos antigos, remove os importados e volta os rótulos de coluna.
    if (snap.deletedIds.length > 0) {
      await prisma.contact.updateMany({ where: { id: { in: snap.deletedIds } }, data: { deletedAt: null } });
    }
    if (snap.createdIds.length > 0) {
      await prisma.contact.updateMany({ where: { id: { in: snap.createdIds } }, data: { deletedAt: new Date() } });
    }
    await prisma.base.update({
      where: { id },
      data: { headers: (snap.oldHeaders ?? {}) as Prisma.InputJsonValue, source: "import" },
    });
  } else if (snap.kind === "merge") {
    // Remove os contatos criados e limpa de volta os campos que foram preenchidos.
    if (snap.createdIds.length > 0) {
      await prisma.contact.updateMany({ where: { id: { in: snap.createdIds } }, data: { deletedAt: new Date() } });
    }
    if (snap.fills.length > 0) {
      await prisma.$transaction(
        snap.fills.map((f) => {
          const data = Object.fromEntries(f.fields.map((field) => [field, null]));
          return prisma.contact.update({ where: { id: f.contactId }, data: { ...data } });
        })
      );
    }
  } else if (snap.kind === "cell_edit") {
    // Volta cada campo editado ao valor anterior.
    const data = Object.fromEntries(snap.fields.map((f) => [f.campo, f.oldValue]));
    await prisma.contact.update({ where: { id: snap.contactId }, data: { ...data } });
    restored = { contactId: snap.contactId, data };
  } else {
    return NextResponse.json({ error: "Tipo de ação não reversível." }, { status: 400 });
  }

  await prisma.baseEvento.update({ where: { id: eventoId }, data: { desfeitoEm: new Date() } });

  return NextResponse.json({ ok: true, restored });
}
