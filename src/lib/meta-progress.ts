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

// A META conta SÓ o território definido nela (planilha + região + estado, ou "toda a planilha")
// e só o que a PRÓPRIA pessoa completou/validou. Tudo que ela faz fora do território continua
// valendo na produção dela (totais, ranking, relatórios) — apenas não entra nesta meta.
// Correção: o que a pessoa resolveu na campanha da meta.

// Registro de validação (Sim/Não) de um contato, já com o território dele. `concluidoEm` é o
// momento do registro (mesmo nome do Fill, para reaproveitar as regras de território).
export type ValidacaoReg = Fill & { valor: "sim" | "nao" };

export function metaDetalhe(
  m: Meta, now: Date, fills: Fill[], corrections: CorrDone[],
  validacoes: ValidacaoReg[] = [], soSim = false
): { feito: number; sim?: number; nao?: number } {
  const start = periodStart(m.prazo, now);
  if (m.tipo === "correcao") {
    const camp = normCampanha(m.campanha);
    const n = corrections.filter(
      (c) => c.resolvedById === m.userId && c.resolvedAt && c.resolvedAt >= start && normCampanha(c.campanha) === camp
    ).length;
    return { feito: n };
  }
  if (m.tipo === "validacao") {
    // Validação: Sim + Não que a PESSOA registrou nas planilhas da meta ("só Sim" é filtro de leitura).
    const todas = validacoes.filter((v) => v.concluidoEm >= start && v.porId === m.userId && territorioConfere(m, v));
    const sim = todas.filter((v) => v.valor === "sim").length;
    return { feito: soSim ? sim : todas.length, sim, nao: todas.length - sim };
  }
  return { feito: fills.filter((f) => f.concluidoEm >= start && f.porId === m.userId && territorioConfere(m, f)).length };
}

export function metaFeito(m: Meta, now: Date, fills: Fill[], corrections: CorrDone[], _compartilhados?: Set<string>, validacoes: ValidacaoReg[] = []): number {
  return metaDetalhe(m, now, fills, corrections, validacoes).feito;
}
