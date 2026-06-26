// Régua de "preenchida/completa" + cores de conclusão, usadas nas telas de bases.
// Ajuste REQUIRED_FIELDS aqui se a régua mudar.
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
