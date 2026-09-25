import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requirePermission } from "@/lib/guard";
import { CONTACT_FIELD_KEYS } from "@/lib/contact-fields";

// Alterar os cabeçalhos das colunas é restrito ao admin. O LDR só preenche os dados.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { deny } = await requireAdmin();
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json();
  // Título de exibição do card da planilha (não mexe no nome/região da base).
  if (typeof body?.titulo === "string") {
    const b = await prisma.base.findUnique({ where: { id }, select: { headers: true } });
    if (!b) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });
    const cur = ((b.headers as Record<string, unknown> | null) || {}) as Record<string, unknown>;
    const titulo = body.titulo.trim().slice(0, 60);
    const next = { ...cur };
    if (titulo) next.__titulo__ = titulo;
    else delete next.__titulo__;
    await prisma.base.update({ where: { id }, data: { headers: next as never } });
    return NextResponse.json({ ok: true });
  }
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
