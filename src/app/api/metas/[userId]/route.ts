import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { ensureMetaTable } from "@/lib/meta";
import { ufSigla } from "@/lib/uf";
import { isCampanhaAtiva } from "@/lib/campanhas";

export const dynamic = "force-dynamic";

// Lista as metas do LDR + as opções dos seletores do popup:
//  - bases → regiões → estados (para metas de preenchimento)
//  - campanhas ativas (para metas de correção)
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { deny } = await requireAdmin();
  if (deny) return deny;
  const { userId } = await params;
  await ensureMetaTable();

  const [metas, bases, pares, comCampanha] = await Promise.all([
    prisma.meta.findMany({
      where: { userId },
      select: { tipo: true, baseId: true, regiao: true, estado: true, campanha: true, prazo: true, alvo: true },
    }),
    prisma.base.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({
      where: { deletedAt: null },
      select: { baseId: true, regiao: true, estado: true },
      distinct: ["baseId", "regiao", "estado"],
    }),
    prisma.contact.findMany({
      where: { deletedAt: null },
      select: { campanha: true },
      distinct: ["campanha"],
    }),
  ]);

  // base → região → conjunto de estados (UF), a partir dos contatos existentes.
  const tree = new Map<string, Map<string, Set<string>>>();
  for (const p of pares) {
    const uf = ufSigla(p.estado);
    if (!uf) continue;
    const regiao = (p.regiao && p.regiao.trim()) || "Sem região";
    if (!tree.has(p.baseId)) tree.set(p.baseId, new Map());
    const regs = tree.get(p.baseId)!;
    if (!regs.has(regiao)) regs.set(regiao, new Set());
    regs.get(regiao)!.add(uf);
  }
  const basesOut = bases.map((b) => ({
    id: b.id,
    name: b.name,
    regioes: Array.from(tree.get(b.id)?.entries() || [])
      .map(([regiao, ufs]) => ({ regiao, estados: Array.from(ufs).sort() }))
      .sort((x, y) => x.regiao.localeCompare(y.regiao)),
  }));

  const campanhas = Array.from(
    new Set(comCampanha.map((c) => (c.campanha || "").trim()).filter((c) => isCampanhaAtiva(c)))
  ).sort();

  return NextResponse.json({ metas, bases: basesOut, campanhas });
}

type RawRow = {
  tipo?: unknown;
  baseId?: unknown;
  regiao?: unknown;
  estado?: unknown;
  campanha?: unknown;
  prazo?: unknown;
  alvo?: unknown;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Substitui todas as metas do LDR pelas enviadas.
export async function PUT(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { deny } = await requireAdmin();
  if (deny) return deny;
  const { userId } = await params;
  await ensureMetaTable();

  const body = await req.json().catch(() => ({}));
  const rawRows: unknown[] = Array.isArray(body?.metas) ? body.metas : [];

  const clean = rawRows
    .map((r) => r as RawRow)
    .map((r) => {
      const tipo = r.tipo === "correcao" ? "correcao" : "preenchimento";
      const prazo = r.prazo === "mensal" ? "mensal" : "semanal";
      const alvo = Math.max(0, Math.min(1_000_000, Math.trunc(Number(r.alvo) || 0)));
      if (tipo === "correcao") {
        return { userId, tipo, baseId: null, regiao: null, estado: null, campanha: str(r.campanha), prazo, alvo };
      }
      return { userId, tipo, baseId: str(r.baseId), regiao: str(r.regiao), estado: str(r.estado), campanha: null, prazo, alvo };
    })
    // Cada tipo exige suas dimensões; sem elas a linha é descartada.
    .filter((r) => (r.tipo === "correcao" ? !!r.campanha : !!(r.baseId && r.regiao && r.estado)))
    .slice(0, 500);

  // Deduplica: preenchimento por base+região+estado; correção por campanha.
  const keyOf = (r: (typeof clean)[number]) =>
    r.tipo === "correcao" ? `c|${r.campanha}` : `p|${r.baseId}|${r.regiao}|${r.estado}`;
  const byKey = new Map(clean.map((r) => [keyOf(r), r] as const));
  const final = [...byKey.values()];

  await prisma.$transaction([
    prisma.meta.deleteMany({ where: { userId } }),
    ...(final.length ? [prisma.meta.createMany({ data: final })] : []),
  ]);

  return NextResponse.json({ ok: true, count: final.length });
}
