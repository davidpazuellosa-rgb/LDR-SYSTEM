import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PARES_CONTRASTE, ESCURO, regraDaClasse, valorEscuro } from "../scripts/tema-paleta.mjs";
import { gerarCss } from "../scripts/tema-gerador.mjs";

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.replace("#", "").slice(i - 1, i + 1), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

test("paleta escura: todos os pares texto/fundo passam no contraste WCAG AA (4,5:1)", () => {
  for (const [nome, fg, bg] of PARES_CONTRASTE as [string, string, string][]) {
    assert.ok(contraste(fg, bg) >= 4.5, `${nome}: ${contraste(fg, bg).toFixed(2)}:1`);
  }
});

test("rótulos coloridos no escuro: texto claro sobre o fundo translúcido continua legível", () => {
  const fundoCard = ESCURO.card as string;
  for (const fam of ["emerald", "amber", "red", "orange", "indigo", "sky", "violet", "rose"]) {
    const txt = valorEscuro("text", fam, "700", null) as string; // ex.: text-emerald-700 → #6ee7b7
    assert.match(txt, /^#/);
    assert.ok(contraste(txt, fundoCard) >= 4.5, `${fam}: ${contraste(txt, fundoCard).toFixed(2)}:1`);
  }
});

test("regras: texto branco não é invertido; fundo branco vira o card; hover e opacidade são traduzidos", () => {
  assert.equal(regraDaClasse("text-white"), null);
  assert.equal(regraDaClasse("bg-white"), `.dark .bg-white{background-color:${ESCURO.card}}`);
  assert.match(regraDaClasse("bg-white/60") as string, /rgba\(23,28,66,0\.6\)/);
  assert.match(regraDaClasse("hover:bg-slate-50") as string, /^\.dark \.hover\\:bg-slate-50:hover\{/);
  assert.match(regraDaClasse("text-slate-800") as string, new RegExp(ESCURO.txt));
  assert.match(regraDaClasse("ring-indigo-300") as string, /--tw-ring-color/);
  assert.equal(regraDaClasse("bg-indigo-600"), null); // botões índigo não mudam
  assert.equal(regraDaClasse("bg-emerald-500"), null); // barras de progresso não mudam
  assert.equal(regraDaClasse("lg:bg-slate-50"), null); // variante não prevista: sem regra (nunca errar o breakpoint)
});

test("o CSS escuro gerado está em dia com as classes de cor usadas no código (rode: npm run tema:gerar)", () => {
  const { css } = gerarCss();
  const arquivo = readFileSync("src/app/tema-escuro.generated.css", "utf8");
  assert.equal(arquivo, css, "classes de cor novas no código: rode `npm run tema:gerar` e faça commit do arquivo gerado");
});

test("a barra lateral não usa classes de paleta mapeadas (fica igual nos dois temas)", () => {
  const t = readFileSync("src/components/Sidebar.tsx", "utf8");
  for (const proibida of ["text-slate-", "bg-white/", "border-white/", "bg-slate-", "text-indigo-3"]) {
    assert.ok(!t.includes(proibida), `Sidebar não deve usar ${proibida}`);
  }
});
