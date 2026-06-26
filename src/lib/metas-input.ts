// Validação/normalização das metas vindas do popup (sem banco) — testável.
// Cada linha usa só as dimensões do seu tipo; linhas sem as dimensões obrigatórias
// são descartadas; deduplica (preenchimento por base+região+estado; correção por campanha).
export type MetaInput = {
  userId: string;
  tipo: string;
  baseId: string | null;
  regiao: string | null;
  estado: string | null;
  campanha: string | null;
  prazo: string;
  alvo: number;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function sanitizeMetas(rawRows: unknown, userId: string): MetaInput[] {
  const rows: unknown[] = Array.isArray(rawRows) ? rawRows : [];
  const clean = rows
    .map((r) => (r ?? {}) as Record<string, unknown>)
    .map((r): MetaInput => {
      const tipo = r.tipo === "correcao" ? "correcao" : "preenchimento";
      const prazo = r.prazo === "mensal" ? "mensal" : r.prazo === "diaria" ? "diaria" : "semanal";
      const alvo = Math.max(0, Math.min(1_000_000, Math.trunc(Number(r.alvo) || 0)));
      if (tipo === "correcao") {
        return { userId, tipo, baseId: null, regiao: null, estado: null, campanha: str(r.campanha), prazo, alvo };
      }
      return { userId, tipo, baseId: str(r.baseId), regiao: str(r.regiao), estado: str(r.estado), campanha: null, prazo, alvo };
    })
    .filter((r) => (r.tipo === "correcao" ? !!r.campanha : !!(r.baseId && r.regiao && r.estado)))
    .slice(0, 500);

  const keyOf = (r: MetaInput) => (r.tipo === "correcao" ? `c|${r.campanha}` : `p|${r.baseId}|${r.regiao}|${r.estado}`);
  return [...new Map(clean.map((r) => [keyOf(r), r] as const)).values()];
}
