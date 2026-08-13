// FONTE ÚNICA das colunas de uma base (planilha).
//
// Antes existiam duas listas paralelas: a grade montava as colunas somando
// campos fixos + personalizadas + rótulos renomeados + ordem + ocultas, e a
// exportação usava CONTACT_FIELDS puro. Toda coluna nova sumia do CSV.
// Agora tela e CSV chamam as MESMAS funções daqui — é impossível divergirem.
//
// Tudo mora em Base.headers (Json), sem migration:
//   headers[key]      -> rótulo renomeado de uma coluna
//   headers.__cols__  -> definição das colunas personalizadas
//   headers.__order__ -> ordem visual (fixas e personalizadas juntas)
//   headers.__hidden__-> colunas ocultas
//   headers.__merges__/__sortBy__ -> mesclas e ordenação (outros arquivos)

// IMPORTANTE: este arquivo é usado pela planilha, que é client component.
// Não importe nada que puxe o prisma (ex.: custom-columns.ts) — o PrismaClient
// iria parar no bundle do navegador e a página quebra com erro de servidor.
import { CONTACT_FIELDS, type ContactField } from "@/lib/contact-fields";

export const COLS_KEY = "__cols__";
export const ORDER_KEY = "__order__";
export const HIDDEN_KEY = "__hidden__";

// Chaves reservadas dentro de headers: são estrutura, não rótulo de coluna.
const isReservedKey = (k: string) => k.startsWith("__") && k.endsWith("__");

export type ResolvedCol =
  | { kind: "native"; key: string; label: string; width?: number; field: ContactField }
  | { kind: "custom"; key: string; label: string; width?: number; col: CustomCol };

type Headers = Record<string, unknown> | null | undefined;

export type CustomCol = { key: string; label: string };

// Lê/normaliza as definições de colunas personalizadas guardadas em headers.__cols__.
export function parseCustomCols(headers: Headers): CustomCol[] {
  const raw = (headers || {})[COLS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({ key: String(c.key || ""), label: String(c.label || "").slice(0, 60) }))
    .filter((c) => c.key && c.label)
    .slice(0, 30);
}

function stringList(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    const s = String(v || "").slice(0, 40);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

// Rótulos renomeados das colunas (sem as chaves reservadas de estrutura).
export function parseHeaderLabels(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (isReservedKey(k)) continue;
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  return out;
}

// Ordem visual compartilhada (arrastar a letra da coluna). Vazio = ordem natural.
export function parseColOrder(headers: Headers): string[] {
  return stringList((headers || {})[ORDER_KEY], 200);
}

// Colunas ocultas/"excluídas" da visão (o dado continua no banco).
export function parseHiddenCols(headers: Headers): string[] {
  return stringList((headers || {})[HIDDEN_KEY], 200);
}

// Planilha NOVA nasce crua: sem nenhuma coluna, para o usuário montar a dele
// (ou deixar a importação montar). As colunas fixas não somem do banco — só
// começam todas ocultas, e voltam sozinhas quando um import as reconhece.
export function headersDeBaseNova(): Record<string, unknown> {
  return { [HIDDEN_KEY]: CONTACT_FIELDS.map((f) => f.key) };
}

// Monta a lista final de colunas VISÍVEIS, na ordem em que aparecem na tela.
// Recebe as partes soltas porque o cliente as tem em estado React (renomear e
// ocultar precisam refletir na hora, antes de o servidor responder).
export function orderColumns({
  labels = {},
  cols = [],
  order = [],
  hidden = [],
}: {
  labels?: Record<string, string>;
  cols?: CustomCol[];
  order?: string[];
  hidden?: string[] | Set<string>;
}): ResolvedCol[] {
  const oculta = hidden instanceof Set ? hidden : new Set(hidden);

  const nativos: ResolvedCol[] = CONTACT_FIELDS.filter((f) => !oculta.has(f.key)).map((field) => ({
    kind: "native",
    key: field.key,
    label: labels[field.key] || field.label,
    width: field.width,
    field,
  }));
  const personalizadas: ResolvedCol[] = cols
    .filter((col) => !oculta.has(col.key))
    .map((col) => ({ kind: "custom", key: col.key, label: labels[col.key] || col.label, col }));

  // Chave sem posição definida entra depois das ordenadas, mantendo a ordem
  // natural entre si (fixas na ordem de CONTACT_FIELDS, depois as personalizadas).
  const posicao = new Map(order.map((k, i) => [k, i]));
  return [...nativos, ...personalizadas]
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const ao = posicao.get(a.item.key) ?? 100000 + a.i;
      const bo = posicao.get(b.item.key) ?? 100000 + b.i;
      return ao - bo;
    })
    .map((x) => x.item);
}

// Versão para o servidor: lê tudo direto de Base.headers.
export function resolveBaseColumns(headers: Headers): ResolvedCol[] {
  return orderColumns({
    labels: parseHeaderLabels(headers),
    cols: parseCustomCols(headers),
    order: parseColOrder(headers),
    hidden: parseHiddenCols(headers),
  });
}

// Ao reordenar/ocultar, as colunas que ficaram de fora da lista visível ainda
// precisam de uma posição guardada (senão voltam pro fim ao serem reexibidas).
export function completeOrder(visibleKeys: string[], allKeys: string[]): string[] {
  const resto = allKeys.filter((k) => !visibleKeys.includes(k));
  return [...visibleKeys, ...resto];
}
