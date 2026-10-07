// Três rankings da equipe (puro, sem banco): atividades, preenchimento e validação.
export type PessoaRank = { id: string; nome: string };
export type ValReg = { pessoaId: string; valor: "sim" | "nao" };

export type LinhaRank = {
  id: string;
  nome: string;
  preenchidas: number;
  corrigidas: number;
  sim: number;
  nao: number;
  validadas: number; // Sim + Não (ou só Sim, se `soSim`)
  taxa: number | null; // % de Sim sobre Sim+Não (null = ninguém validado)
  atividades: number; // preenchidas + corrigidas + validadas
  pctMeta?: number | null; // % da meta do período (null = sem meta)
  ant?: { atividades: number; preenchidas: number; validadas: number }; // período anterior
  oculto?: boolean; // detalhe (Sim/Não/taxa) escondido pelo servidor: é de outra pessoa e quem vê não é admin
};

export function montarLinhas(
  pessoas: PessoaRank[],
  producao: Map<string, { preenchidas: number; corrigidas: number }>,
  validacoes: ValReg[],
  soSim = false
): LinhaRank[] {
  const val = new Map<string, { sim: number; nao: number }>();
  for (const v of validacoes) {
    const c = val.get(v.pessoaId) ?? { sim: 0, nao: 0 };
    if (v.valor === "sim") c.sim++;
    else c.nao++;
    val.set(v.pessoaId, c);
  }
  return pessoas.map((p) => {
    const pr = producao.get(p.id) ?? { preenchidas: 0, corrigidas: 0 };
    const v = val.get(p.id) ?? { sim: 0, nao: 0 };
    const feitas = v.sim + v.nao;
    const validadas = soSim ? v.sim : feitas;
    return {
      id: p.id, nome: p.nome, preenchidas: pr.preenchidas, corrigidas: pr.corrigidas,
      sim: v.sim, nao: v.nao, validadas,
      taxa: feitas > 0 ? Math.round((v.sim / feitas) * 100) : null,
      atividades: pr.preenchidas + pr.corrigidas + validadas,
    };
  });
}

// Privacidade: para quem NÃO é admin, Sim/Não/taxa dos colegas nunca saem do servidor.
export function ocultarDetalhe(linhas: LinhaRank[], meId: string, admin: boolean): LinhaRank[] {
  if (admin) return linhas;
  return linhas.map((l) => (l.id === meId ? l : { ...l, sim: 0, nao: 0, taxa: null, oculto: true }));
}

export type Metrica = "atividades" | "preenchidas" | "validadas" | "pctMeta";

// Variação % contra o período anterior (null = não havia nada antes).
export function variacaoPct(cur: number, ant: number | undefined): number | null {
  if (!ant) return null;
  return Math.round(((cur - ant) / ant) * 100);
}

// Ordena do maior para o menor (empate: nome) e numera. Quem tem 0 fica no fim, sem posição
// destacada — mas continua na lista.
export function ranquear(linhas: LinhaRank[], metrica: Metrica): (LinhaRank & { posicao: number; valor: number })[] {
  return [...linhas]
    .map((l) => ({ ...l, valor: metrica === "pctMeta" ? (l.pctMeta ?? 0) : l[metrica] }))
    .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome))
    .map((l, i) => ({ ...l, posicao: i + 1 }));
}
