// Páginas (abas) da planilha — a faixa "Todas | PR | RS | SC" no rodapé.
//
// Antes a aba existia só enquanto houvesse contato com aquela UF: a lista era
// derivada de Contact.estado, então não dava pra "criar uma página" antes de ter
// dado nela. Agora a lista de UFs também é GUARDADA, e a planilha mostra a união
// de (guardadas + derivadas dos contatos) — o que já existia continua aparecendo.
//
// Mora em Base.headers (Json), sem migration, igual a __cols__/__order__/__hidden__
// (ver src/lib/base-columns.ts). parseHeaderLabels descarta toda chave __*__, então
// estas não vazam como rótulo de coluna.
//
// IMPORTANTE: usado pela planilha (client component) — não importe prisma aqui.
import { ufSigla } from "@/lib/uf";

export const ABAS_KEY = "__abas__"; // string[] de UFs
export const SEMEADA_KEY = "__semeada__"; // já ganhou as linhas iniciais em branco

type Headers = Record<string, unknown> | null | undefined;

// UFs das páginas guardadas, normalizadas em sigla e sem repetição.
export function parseAbas(headers: Headers): string[] {
  const raw = (headers || {})[ABAS_KEY];
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    const uf = ufSigla(String(v || ""));
    if (uf && !out.includes(uf)) out.push(uf);
    if (out.length >= 27) break; // 26 estados + DF
  }
  return out;
}

// Uma base só é semeada com linhas em branco UMA vez. Sem essa marca, apagar
// todas as linhas de propósito faria as 50 ressuscitarem na próxima abertura.
export function foiSemeada(headers: Headers): boolean {
  return (headers || {})[SEMEADA_KEY] === true;
}

// ---- Páginas LIVRES (nome qualquer, não só UF) ----
// A lista de nomes mora em headers.__paginas__; a página de CADA linha é um valor
// reservado em ContactCustomValue (colKey "__pagina__") — sem coluna nova no banco. Na
// planilha a aba de uma página livre tem a chave "p:<nome>".
export const PAGINAS_KEY = "__paginas__";
export const PAGINA_COL = "__pagina__";
export const PREFIXO_PAGINA = "p:";
export const MAX_PAGINAS = 30;
export const MAX_NOME_PAGINA = 40;

// Nome válido: 1 a 40 caracteres, sem começar por "__" (reservado). Devolve o nome
// já aparado ou null.
export function nomePaginaValido(v: unknown): string | null {
  const n = String(v ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_NOME_PAGINA);
  if (!n || n.startsWith("__")) return null;
  return n;
}

export function parsePaginas(headers: Headers): string[] {
  const raw = (headers || {})[PAGINAS_KEY];
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    const n = nomePaginaValido(v);
    if (n && !out.some((x) => x.toLowerCase() === n.toLowerCase())) out.push(n);
    if (out.length >= MAX_PAGINAS) break;
  }
  return out;
}
