import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { ensureMetaTable } from "@/lib/meta";
import { ufSigla } from "@/lib/uf";
import { isCampanhaAtiva } from "@/lib/campanhas";
import { tipoOrgao, regiaoCanonica } from "@/lib/completude";
import { sanitizeMetas } from "@/lib/metas-input";
import { validacaoAtiva } from "@/lib/validacao";

export const dynamic = "force-dynamic";

// Ordem preferida dos tipos de órgão (igual ao nível 1 da página de Bases).
const TIPO_ORDER = ["Prefeitura", "Secretaria de Educação", "Secretaria de Saúde", "SENAI"];
const tipoRank = (t: string) => {
  const i = TIPO_ORDER.indexOf(t);
  return i === -1 ? TIPO_ORDER.length : i;
};

// Lista as metas do LDR + as opções dos seletores do popup:
//  - tipos de órgão → regiões → estados (para metas de preenchimento)
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
    prisma.base.findMany({ select: { id: true, name: true, headers: true }, orderBy: { name: "asc" } }),
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

  // Agrupa por TIPO de órgão (1º seletor do popup). Cada (tipo, região) resolve
  // para a base daquela planilha — é assim que a meta guarda o baseId.
  const tipoMap = new Map<string, Map<string, { regiao: string; baseId: string; estados: string[] }>>();
  const basesById: Record<string, { name: string; tipo: string }> = {};
  for (const b of bases) {
    const tipo = tipoOrgao(b.name);
    basesById[b.id] = { name: b.name, tipo };
    let regs = tree.get(b.id);
    if (!regs || regs.size === 0) {
      // Planilha sem estado/região nos campos do sistema (ex.: nasceu sem colunas, dados só
      // em colunas personalizadas): ainda assim é uma planilha a que se atribui meta — a
      // região vem do nome ("{Órgão} - {Região}") e a meta vale para a planilha toda.
      regs = new Map([[regiaoCanonica(b.name.split(" - ")[1] || "") || "Sem região", new Set<string>()]]);
    }
    if (!tipoMap.has(tipo)) tipoMap.set(tipo, new Map());
    const byRegiao = tipoMap.get(tipo)!;
    for (const [regiao, ufs] of regs.entries()) {
      const ex = byRegiao.get(regiao);
      // Se duas bases do mesmo tipo tiverem a mesma região, une os estados (a 1ª vence o baseId).
      if (ex) ex.estados = Array.from(new Set([...ex.estados, ...ufs])).sort();
      else byRegiao.set(regiao, { regiao, baseId: b.id, estados: Array.from(ufs).sort() });
    }
  }
  const tipos = Array.from(tipoMap.entries())
    .map(([tipo, byRegiao]) => ({
      tipo,
      regioes: Array.from(byRegiao.values()).sort((x, y) => x.regiao.localeCompare(y.regiao)),
    }))
    .sort((x, y) => tipoRank(x.tipo) - tipoRank(y.tipo) || x.tipo.localeCompare(y.tipo));

  const campanhas = Array.from(
    new Set(comCampanha.map((c) => (c.campanha || "").trim()).filter((c) => isCampanhaAtiva(c)))
  ).sort();

  // Planilhas com a validação ligada: só nelas se pode dar meta de validação (meta da planilha toda).
  const validadas = bases
    .filter((b) => validacaoAtiva(b.headers as Record<string, unknown> | null))
    .map((b) => ({ baseId: b.id, nome: b.name, tipo: tipoOrgao(b.name), regiao: regiaoCanonica(b.name.split(" - ")[1] || "") || "Sem região" }));

  return NextResponse.json({ metas, tipos, basesById, campanhas, validadas });
}

// Substitui todas as metas do LDR pelas enviadas.
export async function PUT(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { deny } = await requireAdmin();
  if (deny) return deny;
  const { userId } = await params;
  await ensureMetaTable();

  const body = await req.json().catch(() => ({}));
  const final = sanitizeMetas(body?.metas, userId);

  // Sem trava de território: o mesmo estado pode ter meta para várias pessoas. Quando
  // isso acontece, cada uma conta só o que ela mesma completou (ver territoriosCompartilhados).
  await prisma.$transaction([
    prisma.meta.deleteMany({ where: { userId } }),
    ...(final.length ? [prisma.meta.createMany({ data: final })] : []),
  ]);

  return NextResponse.json({ ok: true, count: final.length });
}
