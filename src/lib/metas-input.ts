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
  dataLimite: Date | null;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v);
  return isNaN(d.getTime()) ? null : d;
}

export function sanitizeMetas(rawRows: unknown, userId: string): MetaInput[] {
  const rows: unknown[] = Array.isArray(rawRows) ? rawRows : [];
  const clean = rows
    .map((r) => (r ?? {}) as Record<string, unknown>)
    .map((r): MetaInput => {
      const tipo = r.tipo === "correcao" ? "correcao" : "preenchimento";
      const prazo = r.prazo === "mensal" ? "mensal" : r.prazo === "diaria" ? "diaria" : "semanal";
      const alvo = Math.max(0, Math.min(1_000_000, Math.trunc(Number(r.alvo) || 0)));
      const dataLimite = parseDate(r.dataLimite);
      if (tipo === "correcao") {
        return { userId, tipo, baseId: null, regiao: null, estado: null, campanha: str(r.campanha), prazo, alvo, dataLimite };
      }
      return { userId, tipo, baseId: str(r.baseId), regiao: str(r.regiao), estado: str(r.estado), campanha: null, prazo, alvo, dataLimite };
    })
    .filter((r) => (r.tipo === "correcao" ? !!r.campanha : !!(r.baseId && r.regiao && r.estado)))
    .slice(0, 500);

  const keyOf = (r: MetaInput) => (r.tipo === "correcao" ? `c|${r.campanha}` : `p|${r.baseId}|${r.regiao}|${r.estado}`);
  return [...new Map(clean.map((r) => [keyOf(r), r] as const)).values()];
}
