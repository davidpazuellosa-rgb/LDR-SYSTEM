import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { ensureMetaTable } from "@/lib/meta";
import { ufSigla } from "@/lib/uf";

export const dynamic = "force-dynamic";

// Lista as metas do LDR + as bases e seus estados (para os seletores do popup).
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { deny } = await requireAdmin();
  if (deny) return deny;
  const { userId } = await params;
  await ensureMetaTable();

  const [metas, bases, pares] = await Promise.all([
    prisma.meta.findMany({ where: { userId }, select: { baseId: true, estado: true, corrigidos: true, preenchidos: true } }),
    prisma.base.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { deletedAt: null }, select: { baseId: true, estado: true }, distinct: ["baseId", "estado"] }),
  ]);

  const estadosByBase = new Map<string, Set<string>>();
  for (const p of pares) {
    const uf = ufSigla(p.estado);
    if (!uf) continue;
    if (!estadosByBase.has(p.baseId)) estadosByBase.set(p.baseId, new Set());
    estadosByBase.get(p.baseId)!.add(uf);
  }
  const basesOut = bases.map((b) => ({ id: b.id, name: b.name, estados: Array.from(estadosByBase.get(b.id) || []).sort() }));

  return NextResponse.json({ metas, bases: basesOut });
}

// Substitui todas as metas do LDR pelas enviadas.
export async function PUT(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { deny } = await requireAdmin();
  if (deny) return deny;
  const { userId } = await params;
  await ensureMetaTable();

  const body = await req.json().catch(() => ({}));
  const rawRows: unknown[] = Array.isArray(body?.metas) ? body.metas : [];
  const clean = rawRows
    .map((r) => r as { baseId?: unknown; estado?: unknown; corrigidos?: unknown; preenchidos?: unknown })
    .filter((r) => typeof r.baseId === "string" && r.baseId && typeof r.estado === "string" && r.estado)
    .map((r) => ({
      userId,
      baseId: r.baseId as string,
      estado: r.estado as string,
      corrigidos: Math.max(0, Math.min(1_000_000, Math.trunc(Number(r.corrigidos) || 0))),
      preenchidos: Math.max(0, Math.min(1_000_000, Math.trunc(Number(r.preenchidos) || 0))),
    }))
    .slice(0, 500);

  // Deduplica por (baseId, estado) — mantém a última ocorrência.
  const byKey = new Map(clean.map((r) => [`${r.baseId}|${r.estado}`, r] as const));
  const final = [...byKey.values()];

  await prisma.$transaction([
    prisma.meta.deleteMany({ where: { userId } }),
    ...(final.length ? [prisma.meta.createMany({ data: final })] : []),
  ]);

  return NextResponse.json({ ok: true, count: final.length });
}
