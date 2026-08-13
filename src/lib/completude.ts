// Régua de "preenchida/completa" + cores de conclusão, usadas nas telas de bases.
// Ajuste REQUIRED_FIELDS aqui se a régua mudar.
//
// IMPORTANTE: usado também pela planilha (client component) — não importe nada
// que puxe o prisma aqui, senão o PrismaClient vai parar no bundle do navegador.
import { CONTACT_FIELD_KEYS } from "@/lib/contact-fields";
export const REQUIRED_FIELDS = [
  "cidade",
  "estado",
  "telefonePrefeitura",
  "emailInstitucional",
  "nomePrefeito",
  "whatsapp",
  "siteOficial",
] as const;

export const REQUIRED_SELECT = {
  cidade: true,
  estado: true,
  telefonePrefeitura: true,
  emailInstitucional: true,
  nomePrefeito: true,
  whatsapp: true,
  siteOficial: true,
} as const;

export type ReqRow = Record<(typeof REQUIRED_FIELDS)[number], string | null>;

const nonEmpty = (v: string | null) => !!(v && v.trim());
export const isComplete = (c: ReqRow) => REQUIRED_FIELDS.every((f) => nonEmpty(c[f]));
// Igual a isComplete, mas ignora campo oculto — coluna escondida não conta pra
// nada na régua de conclusão (nem exige, nem deixa faltando).
export function isCompleteVisivel(c: ReqRow, hidden: Set<string> | string[]) {
  const h = hidden instanceof Set ? hidden : new Set(hidden);
  return REQUIRED_FIELDS.filter((f) => !h.has(f)).every((f) => nonEmpty(c[f]));
}
// Todas as colunas personalizadas da base preenchidas para este contato.
export const customsCompletos = (customKeys: string[], vals: Record<string, string> | undefined) =>
  customKeys.every((k) => !!(vals?.[k] && vals[k].trim()));

// ---- Régua DINÂMICA de conclusão (a que vale hoje) --------------------------
// A linha está concluída quando TODAS as colunas visíveis daquela planilha estão
// preenchidas. Não há mais lista fixa: criou coluna, ela passa a contar; ocultou
// ou excluiu, deixa de contar. Vale para colunas fixas e personalizadas igual.

// Valor de uma célula seja a coluna fixa (mora no contato) ou personalizada
// (mora à parte, em ContactCustomValue) — quem chama não precisa saber qual é.
export function valorDaCelula(
  key: string,
  row: Record<string, unknown>,
  customVals?: Record<string, string>
): string {
  const nativo = row[key];
  if (typeof nativo === "string") return nativo;
  return customVals?.[key] ?? "";
}

export function isRowCompleta(
  visibleKeys: string[],
  row: Record<string, unknown>,
  customVals?: Record<string, string>
): boolean {
  // Planilha sem nenhuma coluna: nada pode ser dado como concluído (senão "todas
  // as colunas preenchidas" seria verdade à toa e as 50 linhas em branco de uma
  // base recém-criada apareceriam como completas).
  if (visibleKeys.length === 0) return false;
  // Linha em branco nunca conta, mesmo que a régua esteja vazia.
  if (isRowVazia(row, customVals)) return false;
  return visibleKeys.every((k) => nonEmpty(valorDaCelula(k, row, customVals)));
}

// Quantas linhas em branco uma planilha nova (ou uma página nova) já nasce tendo,
// para nunca abrir "vazia demais" e sem por onde começar.
export const LINHAS_INICIAIS = 50;

// Estado e região não contam como "dado preenchido": são só o andaime da página
// em que a linha foi criada (a aba é uma UF), não informação que alguém digitou.
const CAMPOS_ANDAIME = new Set(["estado", "regiao"]);
// Só as colunas de dado do contato entram na conta — id/baseId/status/datas
// nunca são vazios e diriam que toda linha tem conteúdo.
const CAMPOS_DE_DADO = CONTACT_FIELD_KEYS.filter((k) => !CAMPOS_ANDAIME.has(k));

// Linha ainda sem nenhum dado real — usada para não inflar os contadores de
// progresso ("a preencher", preenchidos/total das abas) com as linhas em branco
// criadas automaticamente.
export function isRowVazia(
  row: Record<string, unknown>,
  customVals?: Record<string, string>
): boolean {
  for (const k of CAMPOS_DE_DADO) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return false;
  }
  for (const v of Object.values(customVals || {})) {
    if (v && v.trim()) return false;
  }
  return true;
}
export const pctOf = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

// Cores por conclusão: 0 vermelho · 1-49 amarelo · 50-99 laranja · 100 verde.
export function tier(pct: number) {
  if (pct >= 100) return { label: "Concluído", borderL: "border-l-emerald-500", bar: "bg-emerald-500", text: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  if (pct >= 50) return { label: "Quase lá", borderL: "border-l-orange-500", bar: "bg-orange-500", text: "text-orange-600", chip: "bg-orange-50 text-orange-700 ring-orange-200" };
  if (pct > 0) return { label: "Em andamento", borderL: "border-l-amber-400", bar: "bg-amber-400", text: "text-amber-600", chip: "bg-amber-50 text-amber-700 ring-amber-200" };
  return { label: "Não iniciado", borderL: "border-l-red-500", bar: "bg-red-500", text: "text-red-600", chip: "bg-red-50 text-red-700 ring-red-200" };
}

// Tipo de órgão (nível 1 da página de bases). Derivado do nome por enquanto —
// quando surgir Secretaria de Saúde, SENAI etc., é só adicionar aqui (ou virar campo).
// Órgãos novos seguem o padrão de nome "{Órgão} - {Região}".
export function tipoOrgao(name: string): string {
  const n = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (n.includes("aluno a bordo")) return "Secretaria de Educação";
  if (n.includes("cidade na mao")) return "Prefeitura";
  const i = name.indexOf(" - ");
  if (i > 0) return name.slice(0, i).trim();
  return "Órgão";
}

// As 5 macrorregiões do Brasil. Cada órgão tem uma "planilha" (base) por região.
export const REGIOES_BRASIL = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"] as const;
export type Regiao = (typeof REGIOES_BRASIL)[number];

// Normaliza qualquer texto ("Região Nordeste", "nordeste", "CENTRO OESTE") para uma das 5 regiões.
export function regiaoCanonica(value?: string | null): Regiao | null {
  const n = (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^\s*regiao\s+/, "")
    .trim();
  if (!n) return null;
  if (n.includes("nordeste")) return "Nordeste";
  if (n.includes("sudeste")) return "Sudeste";
  if (n.includes("centro") && n.includes("oeste")) return "Centro-Oeste";
  if (n.includes("norte")) return "Norte";
  if (n.includes("sul")) return "Sul";
  return null;
}
