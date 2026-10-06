// Validação de contatos: regras PURAS (sem banco) — usadas pela tela, pelas rotas e pelos testes.
// Uma planilha "validada" tem a coluna Validado (Sim / Não / –). O "–" (ainda não validado)
// é o mesmo que a célula vazia. Fica fora da regra de "linha preenchida".
import { COLS_KEY, HIDDEN_KEY, DELETED_KEY, parseCustomCols, type CustomCol } from "@/lib/base-columns";
import type { OpcaoLista } from "@/lib/coluna-lista";

export const VALIDAR_KEY = "__validar__";
export const VALIDACAO_ROTULO = "Validado";
export const VALIDACAO_CHAVE = "validado";
export const PENDENTE = "–";

export const OPCOES_VALIDACAO: OpcaoLista[] = [
  { valor: "Sim", cor: "verde" },
  { valor: "Não", cor: "vermelho" },
  { valor: PENDENTE, cor: "cinza" },
];

type Headers = Record<string, unknown> | null | undefined;

export const validacaoAtiva = (headers: Headers) => (headers || {})[VALIDAR_KEY] === true;

export const ehColunaValidacao = (c: { sistema?: string } | null | undefined) => c?.sistema === "validacao";

export function colunaValidacao(headers: Headers): CustomCol | null {
  return parseCustomCols(headers).find(ehColunaValidacao) ?? null;
}

// Colunas que entram na regra de "linha preenchida": a de validação nunca entra.
export const colunasDeCompletude = <T extends { sistema?: string }>(cols: T[]): T[] => cols.filter((c) => !ehColunaValidacao(c));

// Valor digitado → "sim" | "nao" | null (null = ainda não validado: vazio ou "–").
export function valorDeValidacao(valor: string | null | undefined): "sim" | "nao" | null {
  const v = (valor ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  if (v === "sim") return "sim";
  if (v === "nao") return "nao";
  return null;
}
// O que fica gravado na célula (o "–" nunca é gravado: é o mesmo que vazio).
export const valorGravado = (v: "sim" | "nao" | null) => (v === "sim" ? "Sim" : v === "nao" ? "Não" : null);

function sistemaCol(base?: CustomCol): CustomCol {
  return {
    key: base?.key || VALIDACAO_CHAVE,
    label: base?.label || VALIDACAO_ROTULO,
    tipo: "lista",
    sistema: "validacao",
    opcoes: OPCOES_VALIDACAO,
  };
}

const sem = (lista: unknown, key: string) => (Array.isArray(lista) ? lista.filter((k) => k !== key) : []);

// Liga a validação: usa a coluna do sistema que já existe; senão ADOTA uma lista chamada
// "Validado" (mantendo os valores); senão cria. Sempre deixa a coluna visível.
export function ligarValidacao(headers: Headers): { headers: Record<string, unknown>; col: CustomCol; criada: boolean; adotada: boolean } {
  const atual = { ...((headers || {}) as Record<string, unknown>) };
  const cols = parseCustomCols(atual);
  const existente = cols.find(ehColunaValidacao);
  const manual = existente
    ? undefined
    : cols.find((c) => c.tipo === "lista" && c.label.trim().toLowerCase() === VALIDACAO_ROTULO.toLowerCase());
  const col = sistemaCol(existente || manual);
  let key = col.key;
  // chave livre se for criar do zero
  if (!existente && !manual) {
    const usadas = new Set(cols.map((c) => c.key));
    let n = 2;
    while (usadas.has(key)) key = `${VALIDACAO_CHAVE}_${n++}`;
    col.key = key;
  }
  const novas = existente || manual ? cols.map((c) => (c.key === col.key ? col : c)) : [...cols, col];
  atual[COLS_KEY] = novas;
  atual[HIDDEN_KEY] = sem(atual[HIDDEN_KEY], col.key);
  atual[DELETED_KEY] = sem(atual[DELETED_KEY], col.key);
  atual[VALIDAR_KEY] = true;
  return { headers: atual, col, criada: !existente && !manual, adotada: !!manual };
}

// Desliga: só oculta a coluna e guarda tudo (valores e créditos). Religar restaura.
export function desligarValidacao(headers: Headers): Record<string, unknown> {
  const atual = { ...((headers || {}) as Record<string, unknown>) };
  const col = parseCustomCols(atual).find(ehColunaValidacao);
  atual[VALIDAR_KEY] = false;
  if (col) {
    const ocultas = Array.isArray(atual[HIDDEN_KEY]) ? (atual[HIDDEN_KEY] as string[]) : [];
    atual[HIDDEN_KEY] = ocultas.includes(col.key) ? ocultas : [...ocultas, col.key];
  }
  return atual;
}

// Protege a coluna do sistema contra edição por quem salva a lista de colunas: com a
// validação ligada, a coluna volta sempre igual ao que o sistema definiu (não dá para
// apagar, renomear nem mudar opções); ninguém consegue marcar outra coluna como "sistema".
export function protegerColunaValidacao(headersAtuais: Headers, recebidas: CustomCol[]): CustomCol[] {
  const atual = colunaValidacao(headersAtuais);
  const ativa = validacaoAtiva(headersAtuais);
  const limpas = recebidas.map((c) => (ehColunaValidacao(c) && c.key !== atual?.key ? { ...c, sistema: undefined } : c)).map((c) => {
    if (c.sistema === undefined) { const { sistema, ...resto } = c; void sistema; return resto as CustomCol; }
    return c;
  });
  if (!ativa || !atual) return limpas;
  const canonica = sistemaCol(atual);
  const tem = limpas.some((c) => c.key === atual.key);
  return tem ? limpas.map((c) => (c.key === atual.key ? canonica : c)) : [...limpas, canonica];
}

// Resumo de uma planilha: contagem por valor, ignorando linhas vazias/excluídas (quem chama filtra).
export function contarValidacao(valores: (string | null | undefined)[]): { sim: number; nao: number; aValidar: number } {
  let sim = 0, nao = 0;
  for (const v of valores) {
    const k = valorDeValidacao(v);
    if (k === "sim") sim++;
    else if (k === "nao") nao++;
  }
  return { sim, nao, aValidar: valores.length - sim - nao };
}
