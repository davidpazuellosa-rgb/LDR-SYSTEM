import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { CONTACT_FIELD_KEYS } from "@/lib/contact-fields";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { deny } = await requirePermission("data.import");
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json();
  const incoming = body?.headers;

  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return NextResponse.json({ error: "Cabeçalhos inválidos" }, { status: 400 });
  }

  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (!CONTACT_FIELD_KEYS.includes(key)) continue;
    clean[key] = String(value ?? "").trim().slice(0, 80);
  }

  if (Object.keys(clean).length === 0) {
    return NextResponse.json({ error: "Nenhum cabeçalho válido" }, { status: 400 });
  }

  const base = await prisma.base.findUnique({
    where: { id },
    select: { headers: true },
  });

  if (!base) {
    return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });
  }

  const current = ((base.headers as Record<string, string> | null) || {}) as Record<string, string>;
  const updated = await prisma.base.update({
    where: { id },
    data: { headers: { ...current, ...clean } },
    select: { headers: true },
  });

  return NextResponse.json({ ok: true, headers: updated.headers });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { deny } = await requirePermission("contacts.delete");
  if (deny) return deny;

  const { id } = await params;
  await prisma.base.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
