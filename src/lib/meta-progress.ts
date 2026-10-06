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
export type Fill = { concluidoEm: Date; baseId: string; regiao: string | null; estado: string | null; porId?: string | null };
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
export const periodStart = (prazo: string, now: Date) =>
  prazo === "mensal" ? startOfMonth(now) : prazo === "diaria" ? startOfDay(now) : startOfWeek(now);

// Fim (exclusivo) do período atual da meta — usado para "ritmo esperado" e janelas.
export function periodEnd(prazo: string, now: Date): Date {
  if (prazo === "mensal") return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  if (prazo === "diaria") {
    const d = startOfDay(now);
    d.setDate(d.getDate() + 1);
    return d;
  }
  return new Date(startOfWeek(now).getTime() + 7 * 86400000);
}

export const regiaoKey = (regiao: string | null) => (regiao && regiao.trim()) || "Sem região";

// Produção realizada de uma meta no seu prazo.
//  - correção: o que ESTE LDR resolveu na campanha, no período
//  - preenchimento: linhas que ficaram completas no território da meta (base+região+
//    estado) no período. Atribuição por TERRITÓRIO — cada estado é de 1 LDR, então o
//    que importa é a linha estar completa, não quem digitou.
// Território (base+região+estado) atribuído a MAIS DE UMA pessoa. Nesse caso cada uma
// conta só o que ela mesma completou; território de uma pessoa só continua contando
// tudo que ficou completo nele (independe de quem digitou).
// Estado "*" = meta da PLANILHA INTEIRA (sem separar por estado). Necessário para
// planilhas que nascem sem colunas padrão (os contatos não têm estado/região nos campos
// do sistema, só nas colunas personalizadas — ex.: Defensoria Pública).
export const ESTADO_TODOS = "*";
export const rotuloEstado = (estado: string | null | undefined) => (estado === ESTADO_TODOS ? "Toda a planilha" : ufSigla(estado) || estado || "—");
// A linha preenchida pertence ao território da meta?
export function territorioConfere(
  m: { baseId: string | null; regiao: string | null; estado: string | null },
  f: { baseId: string; regiao: string | null; estado: string | null }
): boolean {
  if (f.baseId !== m.baseId) return false;
  if (m.estado === ESTADO_TODOS) return true;
  return regiaoKey(f.regiao) === m.regiao && ufSigla(f.estado) === m.estado;
}

export const chaveTerritorio = (m: { baseId: string | null; regiao: string | null; estado: string | null }) =>
  `${m.baseId || ""}|${m.regiao || ""}|${m.estado || ""}`;
export function territoriosCompartilhados(metas: { userId: string; tipo: string; baseId: string | null; regiao: string | null; estado: string | null }[]): Set<string> {
  const donos = new Map<string, Set<string>>();
  for (const m of metas) {
    if (m.tipo === "correcao") continue;
    const k = chaveTerritorio(m);
    (donos.get(k) ?? donos.set(k, new Set()).get(k)!).add(m.userId);
  }
  return new Set([...donos].filter(([, u]) => u.size > 1).map(([k]) => k));
}

// Preenchimento conta TUDO que a própria pessoa completou no período (qualquer
// planilha/região/estado) — o território da meta só separa o que está "na meta" do que
// ficou "fora da meta". Correção continua sendo o que a pessoa resolveu na campanha.
export type ForaItem = { rotulo: string; n: number };

// Onde ficou o que foi preenchido FORA do território da meta: "planilha · UF" com a
// quantidade, do maior para o menor.
export function foraPorTerritorio(
  m: { userId: string; baseId: string | null; regiao: string | null; estado: string | null },
  fills: Fill[],
  start: Date,
  end: Date | null,
  nomeBase: (baseId: string) => string = (id) => id
): ForaItem[] {
  const por = new Map<string, number>();
  for (const f of fills) {
    if (f.porId !== m.userId || f.concluidoEm < start || (end && f.concluidoEm >= end) || territorioConfere(m, f)) continue;
    const rotulo = `${nomeBase(f.baseId)} · ${ufSigla(f.estado) || "sem estado"}`;
    por.set(rotulo, (por.get(rotulo) ?? 0) + 1);
  }
  return [...por].map(([rotulo, n]) => ({ rotulo, n })).sort((a, b) => b.n - a.n || a.rotulo.localeCompare(b.rotulo));
}

export function metaDetalhe(
  m: Meta, now: Date, fills: Fill[], corrections: CorrDone[], nomeBase?: (baseId: string) => string
): { feito: number; naMeta: number; fora: number; foraPor: ForaItem[] } {
  const start = periodStart(m.prazo, now);
  if (m.tipo === "correcao") {
    const camp = normCampanha(m.campanha);
    const n = corrections.filter(
      (c) => c.resolvedById === m.userId && c.resolvedAt && c.resolvedAt >= start && normCampanha(c.campanha) === camp
    ).length;
    return { feito: n, naMeta: n, fora: 0, foraPor: [] };
  }
  const minhas = fills.filter((f) => f.concluidoEm >= start && f.porId === m.userId);
  const naMeta = minhas.filter((f) => territorioConfere(m, f)).length;
  return { feito: minhas.length, naMeta, fora: minhas.length - naMeta, foraPor: foraPorTerritorio(m, fills, start, null, nomeBase) };
}

export function metaFeito(m: Meta, now: Date, fills: Fill[], corrections: CorrDone[], _compartilhados?: Set<string>): number {
  return metaDetalhe(m, now, fills, corrections).feito;
}
