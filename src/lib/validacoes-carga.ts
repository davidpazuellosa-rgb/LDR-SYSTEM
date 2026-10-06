import { prisma } from "@/lib/prisma";
import { ensureContactValidacaoTable } from "@/lib/validacao-db";
import { validacaoAtiva } from "@/lib/validacao";
import type { ValidacaoReg } from "@/lib/meta-progress";

// Registros de validação (Sim/Não) desde `desde`, com o território do contato. Só contam
// contatos não excluídos de planilhas com a validação LIGADA, e registros com pessoa
// (valores antigos sem autor ficam de fora de meta e ranking).
export async function carregarValidacoes(desde: Date, ate?: Date): Promise<ValidacaoReg[]> {
  await ensureContactValidacaoTable();
  const regs = await prisma.contactValidacao.findMany({
    where: { em: { gte: desde, ...(ate ? { lt: ate } : {}) }, porId: { not: null } },
    select: { contactId: true, valor: true, porId: true, em: true },
  });
  if (regs.length === 0) return [];
  const contatos = await prisma.contact.findMany({
    where: { id: { in: regs.map((r) => r.contactId) }, deletedAt: null },
    select: { id: true, baseId: true, regiao: true, estado: true },
  });
  const porId = new Map(contatos.map((c) => [c.id, c]));
  const bases = await prisma.base.findMany({ where: { id: { in: [...new Set(contatos.map((c) => c.baseId))] } }, select: { id: true, headers: true } });
  const ativas = new Set(bases.filter((b) => validacaoAtiva(b.headers as Record<string, unknown> | null)).map((b) => b.id));
  const out: ValidacaoReg[] = [];
  for (const r of regs) {
    const c = porId.get(r.contactId);
    if (!c || !ativas.has(c.baseId)) continue;
    out.push({ concluidoEm: r.em, baseId: c.baseId, regiao: c.regiao, estado: c.estado, porId: r.porId, valor: r.valor === "sim" ? "sim" : "nao" });
  }
  return out;
}
