// Coluna do tipo "lista suspensa": cada célula escolhe UMA opção, cada opção tem uma cor.
// Puro (sem banco) — usado pela tela, pela rota de colunas e pelos testes.
// Só o ADMIN define tipo/opções/cores; quem preenche apenas escolhe (ou limpa).

// Paleta fixa (classes completas, para o Tailwind enxergar). Contraste já conferido.
export const CORES_LISTA = {
  verde: { nome: "Verde", chip: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  vermelho: { nome: "Vermelho", chip: "bg-red-100 text-red-800", dot: "bg-red-500" },
  ambar: { nome: "Âmbar", chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  azul: { nome: "Azul", chip: "bg-sky-100 text-sky-800", dot: "bg-sky-500" },
  roxo: { nome: "Roxo", chip: "bg-violet-100 text-violet-800", dot: "bg-violet-500" },
  rosa: { nome: "Rosa", chip: "bg-pink-100 text-pink-800", dot: "bg-pink-500" },
  laranja: { nome: "Laranja", chip: "bg-orange-100 text-orange-800", dot: "bg-orange-500" },
  cinza: { nome: "Cinza", chip: "bg-slate-200 text-slate-700", dot: "bg-slate-500" },
} as const;
export type CorLista = keyof typeof CORES_LISTA;
export const CORES_ORDEM = Object.keys(CORES_LISTA) as CorLista[];

export type OpcaoLista = { valor: string; cor: CorLista };
export type ColunaExtra = { tipo?: "lista"; opcoes?: OpcaoLista[]; padrao?: string };

export const MAX_OPCOES = 20;
export const MAX_TAM_OPCAO = 40;

// Atalho "Sim / Não" já colorido.
export const OPCOES_SIM_NAO: OpcaoLista[] = [
  { valor: "Sim", cor: "verde" },
  { valor: "Não", cor: "vermelho" },
];

const ehCor = (c: unknown): c is CorLista => typeof c === "string" && c in CORES_LISTA;

// Normaliza a parte "lista" de uma coluna vinda de fora (corpo da requisição ou do
// banco). Texto (sem tipo "lista") devolve {} — colunas antigas ficam exatamente iguais.
export function sanitizarLista(raw: Record<string, unknown>): ColunaExtra {
  if (raw.tipo !== "lista") return {};
  const vistos = new Set<string>();
  const opcoes: OpcaoLista[] = [];
  const bruto = Array.isArray(raw.opcoes) ? raw.opcoes : [];
  for (const o of bruto) {
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    const valor = String(r.valor ?? "").trim().slice(0, MAX_TAM_OPCAO);
    if (!valor || vistos.has(valor.toLowerCase())) continue; // vazio ou repetido
    vistos.add(valor.toLowerCase());
    opcoes.push({ valor, cor: ehCor(r.cor) ? r.cor : "cinza" });
    if (opcoes.length >= MAX_OPCOES) break;
  }
  const padrao = String(raw.padrao ?? "").trim();
  return {
    tipo: "lista",
    opcoes,
    // o padrão só vale se for uma das opções
    ...(padrao && opcoes.some((o) => o.valor === padrao) ? { padrao } : {}),
  };
}

// O valor é aceito pela coluna? Vazio sempre pode (limpar a célula é livre).
export function valorValidoNaLista(opcoes: OpcaoLista[] | undefined, valor: string): boolean {
  if (!valor.trim()) return true;
  return !!opcoes?.some((o) => o.valor === valor);
}

export function corDaOpcao(opcoes: OpcaoLista[] | undefined, valor: string): CorLista | null {
  return opcoes?.find((o) => o.valor === valor)?.cor ?? null;
}
