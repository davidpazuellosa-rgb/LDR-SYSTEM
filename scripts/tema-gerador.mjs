// Gera o CSS do tema escuro a partir das classes de cor usadas no código (função pura de arquivo → texto).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { regraDaClasse } from "./tema-paleta.mjs";

const FAM = "white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const RE = new RegExp(`(?<![\\w-])((?:[a-z0-9-]+:)*(?:bg|text|border|ring|divide|placeholder|fill|stroke|outline|accent|caret|decoration)-(?:${FAM})(?:-\\d{2,3})?(?:/\\d+)?)(?![\\w\\-/])`, "g");

function* arquivos(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    const s = statSync(p);
    if (s.isDirectory()) yield* arquivos(p);
    else if (/\.(tsx|ts)$/.test(n) && !n.includes("generated")) yield p;
  }
}

export function gerarCss(raiz = "src") {
  const classes = new Set();
  for (const f of arquivos(raiz)) for (const m of readFileSync(f, "utf8").matchAll(RE)) classes.add(m[1]);
  const regras = [...classes].sort().map(regraDaClasse).filter(Boolean);
  return { css: `/* ARQUIVO GERADO por scripts/gerar-tema-escuro.mjs — não edite à mão. Tema escuro: ${regras.length} regras. */\n${regras.join("\n")}\n`, classes: classes.size, regras: regras.length };
}
