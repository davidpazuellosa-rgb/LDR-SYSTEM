import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission } from "@/lib/guard";
import { CONTACT_FIELD_KEYS } from "@/lib/contact-fields";
import { REQUIRED_FIELDS, isComplete } from "@/lib/completude";
import { ensureContactFillTable } from "@/lib/contact-fill";

// Edição inline de um contato (formato planilha).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, deny } = await requireUser();
  if (deny) return deny;
  const meId = session?.user?.id || null;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  for (const key of CONTACT_FIELD_KEYS) {
    if (key in body) data[key] = body[key] ? String(body[key]) : null;
  }
  // Formatação por célula (estilo planilha)
  if ("formats" in body) data.formats = body.formats ?? null;

  const contact = await prisma.contact.update({ where: { id }, data });

  // Se um campo da régua mudou, atualiza o registro de conclusão (quem completou e
  // quando). Existe um ContactFill só enquanto a linha está completa; o primeiro a
  // completar fica com o crédito (upsert sem sobrescrever).
  const touchedRequired = REQUIRED_FIELDS.some((f) => f in data);
  if (touchedRequired && meId) {
    await ensureContactFillTable();
    if (isComplete(contact)) {
      await prisma.contactFill.upsert({
        where: { contactId: id },
        create: { contactId: id, preenchidoPorId: meId, concluidoEm: new Date() },
        update: {},
      });
    } else {
      await prisma.contactFill.deleteMany({ where: { contactId: id } });
    }
  }

  return NextResponse.json(contact);
}

// Exclusão REVERSÍVEL (soft delete): marca deletedAt. A linha some das listagens,
// mas pode ser restaurada (desfazer) pelo endpoint /restore.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { deny } = await requirePermission("contacts.delete");
  if (deny) return deny;

  const { id } = await params;
  await prisma.contact.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
