import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { ensureContactCustomTable } from "@/lib/custom-columns";

export const dynamic = "force-dynamic";

// Valor de uma célula de coluna personalizada. Qualquer usuário logado pode preencher.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { deny } = await requireUser();
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const colKey = String(body?.colKey || "").slice(0, 40);
  const valor = body?.valor == null ? null : String(body.valor);
  if (!colKey) return NextResponse.json({ error: "colKey obrigatório" }, { status: 400 });

  await ensureContactCustomTable();
  await prisma.contactCustomValue.upsert({
    where: { contactId_colKey: { contactId: id, colKey } },
    create: { contactId: id, colKey, valor },
    update: { valor },
  });
  return NextResponse.json({ ok: true });
}
