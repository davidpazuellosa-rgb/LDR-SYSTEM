import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { CONTACT_FIELD_KEYS } from "@/lib/contact-fields";

export const dynamic = "force-dynamic";

// Mesclas visuais da planilha (estilo Excel) são compartilhadas por todo o time.
// Guardamos dentro do JSON `headers` da Base, na chave reservada __merges__, para NÃO
// precisar de uma coluna nova (o banco de produção não pode ser migrado por fora).
// Aberta a qualquer usuário logado — o LDR também mescla na sua planilha.
const MERGES_KEY = "__merges__";

type MergeRegion = { anchorId: string; anchorKey: string; rowIds: string[]; colKeys: string[] };

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { deny } = await requireUser();
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const raw = Array.isArray(body?.merges) ? (body.merges as unknown[]) : null;
  if (!raw) return NextResponse.json({ error: "merges inválido" }, { status: 400 });

  const clean: MergeRegion[] = raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .map((m) => ({
      anchorId: String(m.anchorId || ""),
      anchorKey: String(m.anchorKey || ""),
      rowIds: Array.isArray(m.rowIds) ? m.rowIds.map(String).slice(0, 5000) : [],
      colKeys: Array.isArray(m.colKeys)
        ? m.colKeys.map(String).filter((k) => CONTACT_FIELD_KEYS.includes(k))
        : [],
    }))
    .filter((m) => m.anchorId && m.anchorKey && m.rowIds.length > 0 && m.colKeys.length > 0)
    .slice(0, 2000);

  const base = await prisma.base.findUnique({ where: { id }, select: { headers: true } });
  if (!base) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });

  const current = ((base.headers as Record<string, unknown> | null) || {}) as Record<string, unknown>;
  await prisma.base.update({
    where: { id },
    data: { headers: { ...current, [MERGES_KEY]: clean } },
  });

  return NextResponse.json({ ok: true });
}
