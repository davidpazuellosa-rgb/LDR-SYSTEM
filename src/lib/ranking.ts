// Carrega os dados dos três rankings (atividades, preenchimento e validação).
// SEGURANÇA: o ranking só expõe nome e totais; quem vê é sempre o da sessão (o "você").
import { prisma } from "@/lib/prisma";
import { tipoOrgao } from "@/lib/completude";
import { calcularHorarios } from "@/lib/horarios";
import { carregarValidacoes } from "@/lib/validacoes-carga";
import { buildProducao } from "@/lib/producao";
import { montarLinhas, type LinhaRank } from "@/lib/ranking-calc";

export type ParamsRanking = { periodo?: string; de?: string; ate?: string; orgao?: string; valor?: string };

export async function buildRankings(sp: ParamsRanking, viewer: { id: string; admin: boolean }) {
  const soSim = sp.valor === "sim";
  // Preenchimento e correção vêm do mesmo cálculo da "Produção por pessoa" (mesma regra).
  const d = await buildProducao({ periodo: sp.periodo, de: sp.de, ate: sp.ate, orgao: sp.orgao });
  const de = new Date(d.faixa.de);
  const ate = new Date(d.faixa.ate);

  const bases = await prisma.base.findMany({ select: { id: true, name: true } });
  const orgaoDaBase = new Map(bases.map((b) => [b.id, tipoOrgao(b.name)]));
  const vals = (await carregarValidacoes(de, ate)).filter((v) => !sp.orgao || orgaoDaBase.get(v.baseId) === sp.orgao);

  // Quem aparece: operadores (LDR/pré-vendedor). O admin enxerga também quem produziu sem
  // ser operador (ex.: admin que preencheu linhas), como em "Produção por pessoa".
  const operadores = new Set(d.operadorIds);
  const produziu = new Map<string, { preenchidas: number; corrigidas: number }>();
  const nomes = new Map<string, string>();
  for (const l of d.linhas) {
    produziu.set(l.id, { preenchidas: l.producao.preenchimento, corrigidas: l.producao.correcao });
    nomes.set(l.id, l.nome);
  }
  const idsVal = [...new Set(vals.map((v) => v.porId!).filter(Boolean))];
  const faltam = idsVal.filter((id) => !nomes.has(id));
  if (faltam.length) {
    const us = await prisma.user.findMany({ where: { id: { in: faltam } }, select: { id: true, name: true, email: true } });
    for (const u of us) nomes.set(u.id, u.name || u.email);
  }
  const visiveis = [...nomes.keys()].filter((id) => viewer.admin || operadores.has(id) || id === viewer.id);
  const linhas: LinhaRank[] = montarLinhas(
    visiveis.map((id) => ({ id, nome: nomes.get(id) || "—" })),
    produziu,
    vals.filter((v) => v.porId && visiveis.includes(v.porId)).map((v) => ({ pessoaId: v.porId!, valor: v.valor })),
    soSim
  );

  const quandos = (apenas?: string) => vals.filter((v) => (!apenas || v.porId === apenas) && (!soSim || v.valor === "sim")).map((v) => v.concluidoEm);
  const equipe = { sim: vals.filter((v) => v.valor === "sim").length, nao: vals.filter((v) => v.valor === "nao").length };

  return {
    preset: d.preset, de: d.de, ate: d.ate, faixa: d.faixa,
    orgao: sp.orgao || null, soSim,
    orgaos: d.opcoes.orgaos as string[],
    linhas,
    equipe: { ...equipe, taxa: equipe.sim + equipe.nao > 0 ? Math.round((equipe.sim / (equipe.sim + equipe.nao)) * 100) : null },
    horariosEquipe: calcularHorarios(quandos()),
    horariosMeus: calcularHorarios(quandos(viewer.id)),
  };
}
export type Rankings = Awaited<ReturnType<typeof buildRankings>>;
