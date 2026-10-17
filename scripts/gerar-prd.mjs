// Gera src/content/prd.generated.ts a partir de docs/PRD-SASI-LDR-HUB.md.
// Rode depois de editar o PRD:  node scripts/gerar-prd.mjs
import { readFileSync, writeFileSync } from "node:fs";

const md = readFileSync(new URL("../docs/PRD-SASI-LDR-HUB.md", import.meta.url), "utf8");
const ts =
  "// ARQUIVO GERADO por scripts/gerar-prd.mjs a partir de docs/PRD-SASI-LDR-HUB.md — não edite à mão.\n" +
  `export const PRD_MD = ${JSON.stringify(md)};\n`;
writeFileSync(new URL("../src/content/prd.generated.ts", import.meta.url), ts);
console.log(`PRD gerado: ${md.length} caracteres`);
