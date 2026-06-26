import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission } from "@/lib/guard";
import { CONTACT_FIELD_KEYS } from "@/lib/contact-fields";
import { REQUIRED_FIELDS, isComplete } from "@/lib/completude";
import { ensureContactFillTable } from "@/lib/contact-fill";
import { ensureBaseEventoTable } from "@/lib/base-eventos";

// Quantas edições de célula o histórico guarda por base (rodízio).
const HISTORICO_LIMITE = 7;

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

  // Valores ANTES da edição (para o histórico antigo→novo + desfazer).
  const changedKeys = CONTACT_FIELD_KEYS.filter((k) => k in data);
  const before = await prisma.contact.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });

  const contact = await prisma.contact.update({ where: { id }, data });

  // Histórico de edição de célula (rodízio: guarda só as últimas N por base).
  if (meId && changedKeys.length > 0) {
    const beforeRec = before as unknown as Record<string, string | null>;
    const changes = changedKeys
      .map((campo) => ({ campo, de: beforeRec[campo] ?? null, para: (data[campo] as string | null) ?? null }))
      .filter((ch) => (ch.de ?? "") !== (ch.para ?? ""));
    if (changes.length > 0) {
      await ensureBaseEventoTable();
      const autor = await prisma.user.findUnique({ where: { id: meId }, select: { name: true, email: true } });
      await prisma.baseEvento.create({
        data: {
          baseId: before.baseId,
          tipo: "cell_edit",
          usuarioId: meId,
          usuarioNome: autor?.name ?? autor?.email ?? null,
          detalhes: { cidade: before.cidade, estado: before.estado, campos: changes } as Prisma.InputJsonValue,
          snapshot: {
            kind: "cell_edit",
            contactId: id,
            fields: changes.map((c) => ({ campo: c.campo, oldValue: c.de })),
          } as unknown as Prisma.InputJsonValue,
        },
      });
      const extras = await prisma.baseEvento.findMany({
        where: { baseId: before.baseId, tipo: "cell_edit" },
        orderBy: { criadoEm: "desc" },
        select: { id: true },
        skip: HISTORICO_LIMITE,
      });
      if (extras.length > 0) {
        await prisma.baseEvento.deleteMany({ where: { id: { in: extras.map((e) => e.id) } } });
      }
    }
  }

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
