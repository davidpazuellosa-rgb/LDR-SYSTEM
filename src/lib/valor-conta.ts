// Regras de QUALIDADE do valor de uma célula (puro, sem banco, sem "use client": roda no
// servidor e no navegador).
//
//  - Só traços ("-", "--", "- - -", "—", "–"): NÃO conta como preenchido. A linha não conclui e a
//    célula fica laranja. Quem não achou o dado escreve "Não possui" (NAO_POSSUI), que conta.
//  - Escrita suspeita (maiúsculas/minúsculas, espaços, falta de acento, texto sem sentido):
//    só AVISA (filtro + cor roxa). Nunca bloqueia a conclusão da linha.

// Hífen, hífen não separável, travessões, sinal de menos e variantes largas — com ou sem espaço.
const SO_TRACOS = /^[\s\-‐-―−﹘﹣－]+$/;
const TEM_TRACO = /[\-‐-―−﹘﹣－]/;

// Texto que só tem traços e espaços (e pelo menos um traço). Vazio NÃO é "só traços".
export function soTracos(valor: string | null | undefined): boolean {
  const v = (valor ?? "").trim();
  return v.length > 0 && SO_TRACOS.test(v) && TEM_TRACO.test(v);
}

// O valor existe E é um dado de verdade (não vazio, não só traços). É a régua de "preenchido".
export function valorConta(valor: string | null | undefined): boolean {
  const v = (valor ?? "").trim();
  return v.length > 0 && !soTracos(v);
}

// Valor próprio para quando a informação realmente não existe. Conta como preenchido.
export const NAO_POSSUI = "Não possui";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[.\s]+$/g, "").trim();
export function ehNaoPossui(valor: string | null | undefined): boolean {
  return norm(valor ?? "") === "nao possui";
}

// ---------- Escrita suspeita ----------

export type MotivoEscrita = "caixa" | "espaco" | "acento" | "semsentido";
export const ROTULO_MOTIVO: Record<MotivoEscrita, string> = {
  caixa: "Maiúsculas e minúsculas",
  espaco: "Espaços e pontuação",
  acento: "Falta de acento",
  semsentido: "Texto sem sentido",
};

// Palavras comuns que costumam ser escritas SEM o acento. Só a forma sem acento está aqui — se a
// pessoa escreveu "saúde" não cai na lista. Conservador de propósito: melhor deixar passar uma
// do que marcar texto correto.
const SEM_ACENTO = new Set([
  "saude", "educacao", "administracao", "gestao", "habitacao", "servico", "servicos", "publica", "publicas",
  "publico", "publicos", "assistencia", "transito", "comunicacao", "financas", "seguranca", "vigilancia",
  "ciencia", "inovacao", "joao", "jose", "sao", "conceicao", "nao", "ate", "voce", "secretario", "horario",
  "terca", "sabado", "agricola", "economico", "economica", "juridico", "juridica", "tecnico", "tecnica",
  "producao", "previdencia", "orcamento", "usuario", "municipio", "ministerio", "ultimo", "numero",
  "endereco", "area", "calendario", "emergencia", "tributaria", "tributario", "ouvidoria", "licenca",
  "licitacoes", "licitacao", "politica", "politicas", "relacoes", "esportes", "lazer", "protecao",
]);

const VOGAL = /[aeiouáéíóúâêôãõàü]/i;

function ehLinkOuEmail(v: string): boolean {
  return /@/.test(v) || /^(https?:\/\/|www\.)/i.test(v) || /\.[a-z]{2,}(\/|$)/i.test(v) && !/\s/.test(v);
}

// Motivos pelos quais o texto parece mal escrito. Lista vazia = nada suspeito.
export function suspeitasEscrita(valor: string | null | undefined): MotivoEscrita[] {
  const v = valor ?? "";
  if (!valorConta(v) || ehNaoPossui(v) || ehLinkOuEmail(v.trim())) return [];
  const letras = v.match(/\p{L}/gu) ?? [];
  if (letras.length === 0) return []; // telefone, número, etc.
  const motivos: MotivoEscrita[] = [];

  // Espaços e pontuação: espaço sobrando no começo/fim/meio, espaço antes de vírgula/ponto, vírgulas repetidas.
  if (/^\s|\s$|\s{2,}|\s[,.;:]|[,;]{2,}|\.\.(?!\.)/.test(v)) motivos.push("espaco");

  // Maiúsculas e minúsculas: não mexe em texto com números (horários, endereços) nem em sigla curta.
  if (letras.length >= 4 && !/\d/.test(v)) {
    const tudoMaiusculo = v === v.toUpperCase();
    const tudoMinusculo = v === v.toLowerCase();
    const palavras = v.trim().split(/\s+/).length;
    if ((tudoMaiusculo && (palavras >= 2 || letras.length > 8)) || tudoMinusculo) motivos.push("caixa");
  }

  const tokens = v.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);

  // Falta de acento: palavra comum escrita sem acento.
  if (tokens.some((t) => SEM_ACENTO.has(t))) motivos.push("acento");

  // Texto sem sentido: palavra de 5+ letras sem vogal, feita de um bloco repetido ("vgfvgf"),
  // 5+ consoantes seguidas ou a mesma letra 4+ vezes.
  const semSentido = tokens.some((t) => {
    if (t.length >= 5 && !VOGAL.test(t)) return true;
    if (t.length >= 4 && /^(.{2,4})\1+$/u.test(t)) return true;
    if (/(.)\1{3,}/u.test(t)) return true;
    return /[^aeiouáéíóúâêôãõàüy\d_\s]{5,}/iu.test(t);
  });
  if (semSentido) motivos.push("semsentido");

  return motivos;
}

// Classe da célula para a tela: "traco" (laranja) · "naopossui" · null.
export function classeEspecial(valor: string | null | undefined): "traco" | "naopossui" | null {
  if (soTracos(valor)) return "traco";
  if (ehNaoPossui(valor)) return "naopossui";
  return null;
}
