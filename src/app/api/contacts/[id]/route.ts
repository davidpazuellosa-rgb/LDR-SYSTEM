import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission } from "@/lib/guard";
import { CONTACT_FIELD_KEYS } from "@/lib/contact-fields";

// Edição inline de um contato (formato planilha).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { deny } = await requireUser();
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: Record<string, string | null> = {};
  for (const key of CONTACT_FIELD_KEYS) {
    if (key in body) data[key] = body[key] ? String(body[key]) : null;
  }

  const contact = await prisma.contact.update({ where: { id }, data });
  return NextResponse.json(contact);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { deny } = await requirePermission("contacts.delete");
  if (deny) return deny;

  const { id } = await params;
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
