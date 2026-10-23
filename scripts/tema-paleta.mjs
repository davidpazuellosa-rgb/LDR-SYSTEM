// Paleta do TEMA ESCURO (azul-marinho) e regras de tradução das classes de cor do Tailwind.
// Fonte única: usada pelo gerador (scripts/gerar-tema-escuro.mjs) e pelo teste de contraste.

// ---- Tons-base (escuro) ----
export const ESCURO = {
  pagina: "#0f1330", // fundo da página
  card: "#171c42", // cartões e painéis
  elevado: "#1e2452", // menus, janelas
  linha: "#222850", // divisórias suaves, trilhas de barra, zebra
  borda: "#2a3163",
  bordaForte: "#3a4280",
  superficieSutil: "#1a1f48", // hover/realce sutil
  txt: "#e6e9f5",
  txt2: "#9aa3c7",
  txt3: "#8089b5",
  acento: "#5457ec", // botões índigo (texto branco por cima: ≥ 5:1)
  acentoTxt: "#a5b4fc",
};

// Escala neutra (slate/gray/zinc/neutral/stone) traduzida por papel.
const NEUTRO_BG = { 50: ESCURO.superficieSutil, 100: ESCURO.linha, 200: ESCURO.borda, 300: ESCURO.bordaForte };
const NEUTRO_TXT = { 300: "#6b74a0", 400: ESCURO.txt3, 500: ESCURO.txt2, 600: "#b4bbd9", 700: "#cfd4ea", 800: ESCURO.txt, 900: "#f1f3fb", 950: "#ffffff" };
const NEUTRO_BORDA = { 50: ESCURO.linha, 100: ESCURO.linha, 200: ESCURO.borda, 300: ESCURO.bordaForte, 400: "#4a5390" };
const NEUTROS = new Set(["slate", "gray", "zinc", "neutral", "stone"]);

// Famílias coloridas: rgb do tom 500 e tons claros 200/300 (texto no escuro).
export const FAMILIAS = {
  red: { rgb: "239,68,68", t200: "#fecaca", t300: "#fca5a5" },
  rose: { rgb: "244,63,94", t200: "#fecdd3", t300: "#fda4af" },
  orange: { rgb: "249,115,22", t200: "#fed7aa", t300: "#fdba74" },
  amber: { rgb: "245,158,11", t200: "#fde68a", t300: "#fcd34d" },
  yellow: { rgb: "234,179,8", t200: "#fef08a", t300: "#fde047" },
  lime: { rgb: "132,204,22", t200: "#d9f99d", t300: "#bef264" },
  green: { rgb: "34,197,94", t200: "#bbf7d0", t300: "#86efac" },
  emerald: { rgb: "16,185,129", t200: "#a7f3d0", t300: "#6ee7b7" },
  teal: { rgb: "20,184,166", t200: "#99f6e4", t300: "#5eead4" },
  cyan: { rgb: "6,182,212", t200: "#a5f3fc", t300: "#67e8f9" },
  sky: { rgb: "14,165,233", t200: "#bae6fd", t300: "#7dd3fc" },
  blue: { rgb: "59,130,246", t200: "#bfdbfe", t300: "#93c5fd" },
  indigo: { rgb: "99,102,241", t200: "#c7d2fe", t300: "#a5b4fc" },
  violet: { rgb: "139,92,246", t200: "#ddd6fe", t300: "#c4b5fd" },
  purple: { rgb: "168,85,247", t200: "#e9d5ff", t300: "#d8b4fe" },
  fuchsia: { rgb: "217,70,239", t200: "#f5d0fe", t300: "#f0abfc" },
  pink: { rgb: "236,72,153", t200: "#fbcfe8", t300: "#f9a8d4" },
};
const ALFA_BG = { 50: 0.12, 100: 0.18, 200: 0.26, 300: 0.36 };

const hexRgb = (h) => { h = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(","); };
const rgba = (rgb, a) => `rgba(${rgb},${+a.toFixed(3)})`;

// Propriedade CSS por prefixo de utilitário.
const PROP = { bg: "background-color", text: "color", border: "border-color", divide: "border-color", ring: "--tw-ring-color", outline: "outline-color",
  fill: "fill", stroke: "stroke", accent: "accent-color", caret: "caret-color", decoration: "text-decoration-color", placeholder: "color" };

// Devolve o valor escuro para (utilitário, família, tom, opacidade%) ou null = sem mudança.
export function valorEscuro(util, fam, tom, alfaPct) {
  const alfa = alfaPct == null ? 1 : alfaPct / 100;
  const textoLike = ["text", "fill", "stroke", "accent", "caret", "decoration"].includes(util);
  if (fam === "black") return null;
  if (fam === "white") {
    if (util === "bg") return alfa === 1 ? ESCURO.card : rgba(hexRgb(ESCURO.card), alfa);
    if (["border", "ring", "outline"].includes(util)) return alfa === 1 ? ESCURO.card : rgba(hexRgb(ESCURO.card), alfa);
    return null; // text-white etc. ficam brancos (texto sobre botões coloridos)
  }
  const n = tom == null ? null : Number(tom);
  if (n == null) return null;
  if (NEUTROS.has(fam)) {
    let v = null;
    if (util === "bg") v = NEUTRO_BG[n];
    else if (textoLike) v = NEUTRO_TXT[n];
    else if (["border", "divide", "ring", "outline"].includes(util)) v = NEUTRO_BORDA[n];
    else if (util === "placeholder") v = n === 300 ? "#6b74a0" : n === 400 ? "#7d86b2" : n === 500 ? ESCURO.txt2 : null;
    if (!v) return null;
    return alfa === 1 ? v : rgba(hexRgb(v), alfa);
  }
  const f = FAMILIAS[fam];
  if (!f) return null;
  if (util === "bg") { const a = ALFA_BG[n]; return a ? rgba(f.rgb, a * alfa) : null; }
  if (textoLike) { const v = n === 600 || n === 700 ? f.t300 : n === 800 || n === 900 || n === 950 ? f.t200 : null; return v ? (alfa === 1 ? v : rgba(hexRgb(v), alfa)) : null; }
  if (["border", "divide", "ring", "outline"].includes(util)) return n >= 50 && n <= 300 ? rgba(f.rgb, 0.35 * alfa) : null;
  if (util === "placeholder") return null;
  return null;
}

export const esc = (s) => s.replace(/([:/.\[\]#%,])/g, "\\$1");

// Monta a regra CSS de UMA classe usada no código (ex.: "hover:bg-slate-50/60"). null = nada a fazer.
export function regraDaClasse(token) {
  const m = token.match(/^((?:[a-z0-9-]+:)*)(bg|text|border|ring|divide|placeholder|fill|stroke|outline|accent|caret|decoration)-([a-z]+)(?:-(\d{2,3}))?(?:\/(\d+))?$/);
  if (!m) return null;
  const [, pref, util, fam, tom, alfa] = m;
  const val = valorEscuro(util, fam, tom, alfa ? Number(alfa) : null);
  if (!val) return null;
  const prefs = pref ? pref.split(":").filter(Boolean) : [];
  let pseudo = "", antes = "", depois = "";
  for (const p of prefs) {
    if (p === "hover") pseudo += ":hover";
    else if (p === "focus") pseudo += ":focus";
    else if (p === "focus-visible") pseudo += ":focus-visible";
    else if (p === "active") pseudo += ":active";
    else if (p === "disabled") pseudo += ":disabled";
    else if (p === "placeholder") depois += "::placeholder";
    else if (p === "group-hover") antes = ".group:hover ";
    else return null; // variante não prevista: não gera regra (melhor perder uma cor do que errar)
  }
  const prop = PROP[util];
  let seletor = `.dark ${antes}.${esc(token)}${pseudo}${depois}`;
  if (util === "divide") seletor = `.dark ${antes}.${esc(token)}${pseudo} > :not(:last-child)`;
  if (util === "placeholder" && !depois) seletor = `.dark ${antes}.${esc(token)}${pseudo}::placeholder`;
  return `${seletor}{${prop}:${val}}`;
}

// Pares texto/fundo que o teste confere (WCAG AA ≥ 4,5, ou 3 para decorativos).
export const PARES_CONTRASTE = [
  ["texto principal / card", ESCURO.txt, ESCURO.card],
  ["texto principal / página", ESCURO.txt, ESCURO.pagina],
  ["texto principal / elevado", ESCURO.txt, ESCURO.elevado],
  ["texto secundário / card", ESCURO.txt2, ESCURO.card],
  ["texto de apoio / card", ESCURO.txt3, ESCURO.card],
  ["texto de apoio / página", ESCURO.txt3, ESCURO.pagina],
  ["link índigo / card", ESCURO.acentoTxt, ESCURO.card],
  ["branco / botão índigo", "#ffffff", ESCURO.acento],
];
