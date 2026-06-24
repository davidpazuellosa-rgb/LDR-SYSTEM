import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { CONTACT_FIELDS } from "@/lib/contact-fields";
import { STATUS_META } from "@/lib/status";

// Exporta os contatos da base em CSV. Somente quem tem permissão (admin).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { deny } = await requirePermission("data.export");
  if (deny) return deny;

  const { id } = await params;
  const base = await prisma.base.findUnique({
    where: { id },
    include: { contacts: { where: { deletedAt: null }, orderBy: [{ estado: "asc" }, { cidade: "asc" }] } },
  });
  if (!base) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });

  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const headers = [...CONTACT_FIELDS.map((f) => f.label), "Situação"];
  const lines = [headers.join(";")];
  for (const c of base.contacts as unknown as Record<string, string>[]) {
    const row = CONTACT_FIELDS.map((f) => esc(c[f.key]));
    row.push(esc(STATUS_META[c.status]?.label || c.status));
    lines.push(row.join(";"));
  }
  const csv = "﻿" + lines.join("\n"); // BOM para acentos no Excel

  const filename = base.name.replace(/[^a-z0-9]+/gi, "_") + ".csv";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
