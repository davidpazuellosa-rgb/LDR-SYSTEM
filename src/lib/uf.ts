// Converte qualquer forma de estado para a SIGLA de 2 letras (UF).
// Aceita: "Mato Grosso do Sul (MS)" -> MS, "Bahia" -> BA, "BA" -> BA, "MS" -> MS.
// Usado em TODO o sistema para exibir sempre só a sigla.

const NOME_PARA_UF: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE",
  "distrito federal": "DF", "espirito santo": "ES", goias: "GO", maranhao: "MA",
  "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", para: "PA",
  paraiba: "PB", parana: "PR", pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO", roraima: "RR",
  "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};
const SIGLAS = new Set(Object.values(NOME_PARA_UF));

// As 27 UFs em ordem alfabética — usada no seletor de "nova página" da planilha.
export const UFS_BRASIL = Array.from(SIGLAS).sort();

// Região de cada UF — usada na importação para derivar a região quando a
// planilha não traz essa coluna, mas já dá pra saber pelo estado.
const REGIAO_DA_UF: Record<string, string> = {
  AC: "Norte", AP: "Norte", AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};
export function regiaoDaUf(uf?: string | null): string {
  return REGIAO_DA_UF[ufSigla(uf)] || "";
}
// Uma sigla de UF "de verdade" — só bate exato (2 letras válidas), nunca chute
// (ufSigla() tem um fallback de "2 primeiras letras" que serve pra exibição,
// não pra decidir automaticamente o estado de uma aba/planilha inteira).
export function ehUfValida(value?: string | null): boolean {
  const v = (value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(v) && SIGLAS.has(v);
}
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function ufSigla(value?: string | null): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  // sigla entre parênteses: "... (MS)"
  const paren = raw.match(/\(\s*([A-Za-z]{2})\s*\)/);
  if (paren && SIGLAS.has(paren[1].toUpperCase())) return paren[1].toUpperCase();
  // já é uma sigla de 2 letras
  if (/^[A-Za-z]{2}$/.test(raw) && SIGLAS.has(raw.toUpperCase())) return raw.toUpperCase();
  // nome completo (com ou sem "(xx)" no fim)
  const semParen = norm(raw.replace(/\([^)]*\)/g, ""));
  if (NOME_PARA_UF[semParen]) return NOME_PARA_UF[semParen];
  if (NOME_PARA_UF[norm(raw)]) return NOME_PARA_UF[norm(raw)];
  // fallback: 2 primeiras letras em maiúsculo
  return raw.toUpperCase().slice(0, 2);
}
