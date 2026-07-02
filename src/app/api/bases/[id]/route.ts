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
  const incoming = body?.headers;

  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return NextResponse.json({ error: "Cabeçalhos inválidos" }, { status: 400 });
  }

  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (key === "__colOrder__") continue;
    if (!CONTACT_FIELD_KEYS.includes(key)) continue;
    clean[key] = String(value ?? "").trim().slice(0, 80);
  }
  const allowedHeaderKeys = new Set<string>(CONTACT_FIELD_KEYS);
  const rawColOrder = (incoming as Record<string, unknown>).__colOrder__;
  const colOrder = Array.isArray(rawColOrder)
    ? rawColOrder.map((key: unknown) => String(key).slice(0, 40)).filter((key) => allowedHeaderKeys.has(key))
    : null;
  const rawHeaderFormats = (incoming as Record<string, unknown>).__headerFormats__;
  const headerFormats =
    rawHeaderFormats && typeof rawHeaderFormats === "object" && !Array.isArray(rawHeaderFormats)
      ? rawHeaderFormats
      : null;
  const rawHeaderRowName = (incoming as Record<string, unknown>).__headerRowName__;
  const headerRowName = typeof rawHeaderRowName === "string" ? rawHeaderRowName.trim().slice(0, 40) : null;

  if (Object.keys(clean).length === 0 && !colOrder && !headerFormats && !headerRowName) {
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
    data: {
      headers: {
        ...current,
        ...clean,
        ...(colOrder ? { __colOrder__: colOrder } : {}),
        ...(headerFormats ? { __headerFormats__: headerFormats } : {}),
        ...(headerRowName ? { __headerRowName__: headerRowName } : {}),
      },
    },
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
