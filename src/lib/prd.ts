// PRD do sistema dentro do próprio sistema (Configurações → LDR Hub).
// Dividido por seções ("# N. Título"); as seções internas (arquitetura, requisitos técnicos,
// riscos/roadmap, decisões e anexos) só saem do servidor para administradores.
import { marked } from "marked";
import { PRD_MD } from "@/content/prd.generated";

export type SecaoPrd = { id: string; n: number | null; titulo: string; html: string; texto: string; restrito: boolean };

// Partes só para admin (números das seções do PRD): 15 arquitetura/modelo de dados, 16 requisitos
// não funcionais (segurança e LGPD), 18 riscos e roadmap, 19 decisões/perguntas, 20 anexos.
const RESTRITAS = new Set([15, 16, 18, 19, 20]);

const semMarcas = (s: string) => s.replace(/[#*`>|_-]+/g, " ").replace(/\s+/g, " ").trim();

export function secoesPrd(admin: boolean): { titulo: string; intro: string; secoes: SecaoPrd[] } {
  const partes = PRD_MD.split(/\n(?=# )/);
  const cabeca = partes.shift() || "";
  // título e bloco de metadados (tabela) = tudo antes do "Sumário"
  const titulo = (cabeca.match(/^# (.+)$/m)?.[1] || "SASI LDR Hub").trim();
  const intro = cabeca.split(/\n## Sumário/)[0].replace(/^# .+\n/, "");
  const secoes: SecaoPrd[] = [];
  for (const bloco of partes) {
    const linha = bloco.split("\n", 1)[0].replace(/^# /, "").trim();
    const m = linha.match(/^(\d+)\.\s*(.+)$/);
    const n = m ? Number(m[1]) : null;
    const restrito = n !== null && RESTRITAS.has(n);
    if (restrito && !admin) continue;
    const corpo = bloco.split("\n").slice(1).join("\n").replace(/\n---\s*$/g, "").replace(/^---\s*$/gm, "");
    secoes.push({
      id: `parte-${n ?? secoes.length}`,
      n,
      titulo: m ? m[2] : linha,
      html: marked.parse(corpo, { async: false, gfm: true }) as string,
      texto: semMarcas(corpo).toLowerCase(),
      restrito,
    });
  }
  return { titulo, intro: marked.parse(intro, { async: false, gfm: true }) as string, secoes };
}
