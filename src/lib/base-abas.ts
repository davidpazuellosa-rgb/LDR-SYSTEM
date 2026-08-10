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
