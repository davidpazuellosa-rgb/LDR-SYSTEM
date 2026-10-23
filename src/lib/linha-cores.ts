// Cores automáticas da planilha (calculadas na tela, nada é gravado):
//   - linha COMPLETA → todas as células em verde suave;
//   - faltam 1 ou 2 células → só as vazias que faltam em amarelo;
//   - faltam 3+ (ou linha sem nenhum dado) → sem cor.
// "Completa" segue a MESMA regra do sistema: campos obrigatórios VISÍVEIS + colunas
// personalizadas VISÍVEIS (a coluna Validado não conta). Coluna oculta não é exigida.
import { REQUIRED_FIELDS } from "@/lib/completude";

export const LIMITE_QUASE = 2;

export type EstadoLinha = {
  tipo: "vazia" | "normal" | "quase" | "completa";
  faltam: string[]; // chaves das colunas exigidas que estão vazias
};

// Chaves exigidas de uma planilha: obrigatórios nativos visíveis + personalizadas visíveis (sem a de validação).
export function chavesExigidas(
  ocultas: Set<string> | string[],
  colunasPersonalizadas: { key: string; sistema?: string }[]
): string[] {
  const h = ocultas instanceof Set ? ocultas : new Set(ocultas);
  return [
    ...REQUIRED_FIELDS.filter((f) => !h.has(f)),
    ...colunasPersonalizadas.filter((c) => !h.has(c.key) && c.sistema !== "validacao").map((c) => c.key),
  ];
}

export function estadoDaLinha(exigidas: string[], valorDe: (chave: string) => string, linhaVazia: boolean): EstadoLinha {
  if (linhaVazia) return { tipo: "vazia", faltam: [] };
  const faltam = exigidas.filter((k) => !valorDe(k).trim());
  if (faltam.length === 0) return { tipo: "completa", faltam };
  if (faltam.length <= LIMITE_QUASE) return { tipo: "quase", faltam };
  return { tipo: "normal", faltam };
}

export const COR_COMPLETA = "var(--cel-ok)"; // verde suave (variável: muda no tema escuro)
export const COR_FALTA = "var(--cel-falta)"; // amarelo (mesma família do indicador "a preencher")

// Fundo automático de uma célula (ou null = sem cor).
export function corDaCelula(estado: EstadoLinha | undefined, chave: string): string | null {
  if (!estado) return null;
  if (estado.tipo === "completa") return COR_COMPLETA;
  if (estado.tipo === "quase" && estado.faltam.includes(chave)) return COR_FALTA;
  return null;
}

// Próxima célula que falta DEPOIS da posição atual, na ordem da tela (linha, depois coluna), dando a
// volta ao fim. Considera todas as linhas incompletas com dado (as do indicador "a preencher").
export function proximaCelulaQueFalta(
  linhas: { estado: EstadoLinha | undefined }[],
  colunaDe: (chave: string) => number | undefined,
  atual: { row: number; col: number } | null
): { row: number; col: number } | null {
  const pos: { row: number; col: number }[] = [];
  linhas.forEach((l, row) => {
    if (!l.estado || l.estado.tipo === "vazia" || l.estado.tipo === "completa") return;
    const cols = l.estado.faltam.map(colunaDe).filter((c): c is number => c !== undefined).sort((a, b) => a - b);
    for (const col of cols) pos.push({ row, col });
  });
  if (pos.length === 0) return null;
  if (!atual) return pos[0];
  return pos.find((p) => p.row > atual.row || (p.row === atual.row && p.col > atual.col)) ?? pos[0];
}
