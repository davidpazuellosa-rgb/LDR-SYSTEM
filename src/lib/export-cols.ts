// Colunas dos CSVs de Relatórios — fonte única para o popup (cliente) e as rotas (servidor).
// A ordem aqui TEM que ser a mesma da linha de cabeçalho de cada rota.
export const EXPORT_COLS = {
  producao: ["Posição", "LDR", "Preenchidas", "Corrigidas", "Total"],
  metas: ["LDR", "Meta", "Tipo", "Alvo", "Feito", "Percentual", "Situação"],
  pessoas: ["Pessoa", "Meta no período", "Feito (meta)", "% da meta", "Preenchidas", "Corrigidas", "Total produzido", "Situação"],
  detalhe: ["Pessoa", "Dia", "Tipo", "Órgão", "Região", "Estado", "Campanha", "Quantidade"],
} as const;

// Aplica ?cols=0,2,3 (índices) a uma matriz de linhas. Sem o parâmetro, devolve tudo.
export function filtrarColunas<T>(rows: T[][], cols: string | null): T[][] {
  if (cols === null) return rows;
  const idx = cols.split(",").map((s) => Number(s)).filter((n) => Number.isInteger(n) && n >= 0);
  if (idx.length === 0) return rows;
  return rows.map((r) => idx.filter((i) => i < r.length).map((i) => r[i]));
}
