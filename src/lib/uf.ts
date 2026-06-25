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
