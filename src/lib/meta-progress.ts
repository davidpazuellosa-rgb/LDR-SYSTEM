// Lógica pura de produção das metas (sem banco) — usada pelo dashboard e testável.
import { ufSigla } from "@/lib/uf";
import { normCampanha } from "@/lib/campanhas";

export type Meta = {
  id: string;
  userId: string;
  tipo: string;
  baseId: string | null;
  regiao: string | null;
  estado: string | null;
  campanha: string | null;
  prazo: string;
  alvo: number;
};
export type Fill = { concluidoEm: Date; baseId: string; regiao: string | null; estado: string | null };
export type CorrDone = { resolvedById: string | null; resolvedAt: Date | null; campanha: string | null };

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // segunda = 0
  x.setDate(x.getDate() - dow);
  return x;
}
export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export const periodStart = (prazo: string, now: Date) => (prazo === "mensal" ? startOfMonth(now) : startOfWeek(now));

export const regiaoKey = (regiao: string | null) => (regiao && regiao.trim()) || "Sem região";

// Produção realizada de uma meta no seu prazo.
//  - correção: o que ESTE LDR resolveu na campanha, no período
//  - preenchimento: linhas que ficaram completas no território da meta (base+região+
//    estado) no período. Atribuição por TERRITÓRIO — cada estado é de 1 LDR, então o
//    que importa é a linha estar completa, não quem digitou.
export function metaFeito(m: Meta, now: Date, fills: Fill[], corrections: CorrDone[]): number {
  const start = periodStart(m.prazo, now);
  if (m.tipo === "correcao") {
    const camp = normCampanha(m.campanha);
    return corrections.filter(
      (c) => c.resolvedById === m.userId && c.resolvedAt && c.resolvedAt >= start && normCampanha(c.campanha) === camp
    ).length;
  }
  return fills.filter(
    (f) => f.concluidoEm >= start && f.baseId === m.baseId && regiaoKey(f.regiao) === m.regiao && ufSigla(f.estado) === m.estado
  ).length;
}
