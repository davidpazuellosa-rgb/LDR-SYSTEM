import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/guard";
import { restaurarBase, apagarDefinitivo } from "@/lib/lixeira";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Restaura uma planilha da lixeira (mesma permissão de apagar).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { deny } = await requirePermission("contacts.delete");
  if (deny) return deny;
  const { id } = await params;
  const r = await restaurarBase(id);
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 409 });
  return NextResponse.json({ ok: true, baseId: r.baseId });
}

// Apaga DE VEZ um item da lixeira.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { deny } = await requirePermission("contacts.delete");
  if (deny) return deny;
  const { id } = await params;
  await apagarDefinitivo(id);
  return NextResponse.json({ ok: true });
}
