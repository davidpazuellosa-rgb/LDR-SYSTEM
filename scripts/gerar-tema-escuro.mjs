// Gera src/app/tema-escuro.generated.css. Rode depois de usar uma classe de cor nova:
//   node scripts/gerar-tema-escuro.mjs      (ou: npm run tema:gerar)
import { writeFileSync } from "node:fs";
import { gerarCss } from "./tema-gerador.mjs";

const { css, classes, regras } = gerarCss();
writeFileSync("src/app/tema-escuro.generated.css", css);
console.log(`${classes} classes de cor encontradas → ${regras} regras escuras`);
