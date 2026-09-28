// Cálculo PURO (sem banco) do relatório "Produção por pessoa": períodos, filtros,
// normalização de metas e agregações. O carregamento do banco fica em producao.ts.
import { normCampanha } from "@/lib/campanhas";
import { chaveTerritorio } from "@/lib/meta-progress";

export type TipoEvento = "preenchimento" | "correcao";
export type Evento = {
  tipo: TipoEvento;
  pessoaId: string;
  quando: Date;
  baseId: string;
  orgao: string;
  regiao: string | null;
  estado: string | null; // sigla (UF)
  campanha: string | null;
};
export type MetaIn = {
  id: string;
  userId: string;
  tipo: string;
  baseId: string | null;
  regiao: string | null;
  estado: string | null;
  campanha: string | null;
  prazo: string;
  alvo: number;
  orgao: string; // tipo de órgão da base da meta ("" p/ correção)
};
export type Filtros = {
  orgao: string | null;
  regioes: string[];
  estados: string[];
  pessoas: string[];
  campanhas: string[];
  tipo: "tudo" | TipoEvento;
};
export type Faixa = { de: Date; ate: Date }; // [de, ate)

const DIA = 86400000;
const BRT = 3 * 3600000;

// Início do dia em Brasília (UTC-3) que contém `d`.
export function inicioDoDiaBRT(d: Date): Date {
  const s = new Date(d.getTime() - BRT);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()) + BRT);
}
const inicioDoMesBRT = (d: Date, delta = 0) => {
  const s = new Date(d.getTime() - BRT);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + delta, 1) + BRT);
};

export const PRESETS = ["hoje", "7d", "30d", "mes", "mes-passado", "personalizado"] as const;
export type Preset = (typeof PRESETS)[number];
export const PRESET_LABEL: Record<Preset, string> = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  mes: "Este mês",
  "mes-passado": "Mês passado",
  personalizado: "Personalizado",
};

const ymd = /^\d{4}-\d{2}-\d{2}$/;
const dataBRT = (s: string) => new Date(Date.parse(`${s}T00:00:00Z`) + BRT);

export function faixaDoPeriodo(preset: Preset, now: Date, de?: string | null, ate?: string | null): Faixa {
  const hoje = inicioDoDiaBRT(now);
  switch (preset) {
    case "hoje":
      return { de: hoje, ate: new Date(hoje.getTime() + DIA) };
    case "30d":
      return { de: new Date(hoje.getTime() - 29 * DIA), ate: new Date(hoje.getTime() + DIA) };
    case "mes":
      return { de: inicioDoMesBRT(now), ate: inicioDoMesBRT(now, 1) };
    case "mes-passado":
      return { de: inicioDoMesBRT(now, -1), ate: inicioDoMesBRT(now) };
    case "personalizado": {
      if (de && ymd.test(de)) {
        const ini = dataBRT(de);
        const fimBase = ate && ymd.test(ate) ? dataBRT(ate) : ini;
        const fim = new Date(Math.max(fimBase.getTime(), ini.getTime()) + DIA);
        return { de: ini, ate: fim };
      }
      return { de: new Date(hoje.getTime() - 6 * DIA), ate: new Date(hoje.getTime() + DIA) };
    }
    default:
      return { de: new Date(hoje.getTime() - 6 * DIA), ate: new Date(hoje.getTime() + DIA) };
  }
}

export function parsePreset(v?: string | null): Preset {
  return (PRESETS as readonly string[]).includes(v || "") ? (v as Preset) : "7d";
}

// Mesmo tamanho, imediatamente antes.
export const faixaAnterior = (f: Faixa): Faixa => ({ de: new Date(f.de.getTime() - (f.ate.getTime() - f.de.getTime())), ate: f.de });

export const diasDaFaixa = (f: Faixa) => Math.max(1, Math.round((f.ate.getTime() - f.de.getTime()) / DIA));

const naFaixa = (d: Date, f: Faixa) => d >= f.de && d < f.ate;

// ---- Filtros ----
export function filtrarEventos(eventos: Evento[], f: Filtros, faixa: Faixa): Evento[] {
  return eventos.filter((e) => {
    if (!naFaixa(e.quando, faixa)) return false;
    if (f.tipo !== "tudo" && e.tipo !== f.tipo) return false;
    if (f.pessoas.length && !f.pessoas.includes(e.pessoaId)) return false;
    if (f.campanhas.length && !f.campanhas.some((c) => normCampanha(c) === normCampanha(e.campanha))) return false;
    if (f.orgao && e.orgao !== f.orgao) return false;
    if (f.regioes.length && !f.regioes.includes(e.regiao || "Sem região")) return false;
    if (f.estados.length && !(e.estado && f.estados.includes(e.estado))) return false;
    return true;
  });
}

// ---- Metas ----
const DIAS_DO_PRAZO: Record<string, number> = { diaria: 1, semanal: 7, mensal: 30 };

// Meta proporcional ao período escolhido (semanal de 10 em 14 dias = 20).
export function metaNormalizada(alvo: number, prazo: string, faixa: Faixa): number {
  return Math.round((alvo * diasDaFaixa(faixa)) / (DIAS_DO_PRAZO[prazo] || 7));
}

export function filtrarMetas(metas: MetaIn[], f: Filtros): MetaIn[] {
  const territorial = !!(f.orgao || f.regioes.length || f.estados.length);
  return metas.filter((m) => {
    if (f.pessoas.length && !f.pessoas.includes(m.userId)) return false;
    if (m.tipo === "correcao") {
      if (f.tipo === "preenchimento" || territorial) return false;
      if (f.campanhas.length && !f.campanhas.some((c) => normCampanha(c) === normCampanha(m.campanha))) return false;
      return true;
    }
    if (f.tipo === "correcao" || f.campanhas.length) return false;
    if (f.orgao && m.orgao !== f.orgao) return false;
    if (f.regioes.length && !f.regioes.includes(m.regiao || "Sem região")) return false;
    if (f.estados.length && !(m.estado && f.estados.includes(m.estado))) return false;
    return true;
  });
}

export type StatusMeta = "ok" | "risco" | "atrasado";
export type MetaCalc = {
  id: string;
  userId: string;
  tipo: string;
  rotulo: string;
  prazo: string;
  meta: number;
  feito: number;
  p: number;
  esperado: number;
  status: StatusMeta;
};

// Realizado de uma meta na faixa: preenchimento por TERRITÓRIO (não importa quem digitou),
// correção por quem resolveu — a mesma regra do dashboard e de Minhas Metas.
export function feitoDaMeta(m: MetaIn, todos: Evento[], faixa: Faixa, compartilhados?: Set<string>): number {
  if (m.tipo === "correcao") {
    const c = normCampanha(m.campanha);
    return todos.filter((e) => e.tipo === "correcao" && e.pessoaId === m.userId && normCampanha(e.campanha) === c && naFaixa(e.quando, faixa)).length;
  }
  // Território com mais de uma pessoa: cada uma conta só o que ela mesma completou.
  const dividido = !!compartilhados?.has(chaveTerritorio(m));
  return todos.filter(
    (e) =>
      e.tipo === "preenchimento" && e.baseId === m.baseId && (e.regiao || "Sem região") === m.regiao && e.estado === m.estado &&
      naFaixa(e.quando, faixa) && (!dividido || e.pessoaId === m.userId)
  ).length;
}

export function calcularMeta(m: MetaIn, todos: Evento[], faixa: Faixa, now: Date, rotulo: string, compartilhados?: Set<string>): MetaCalc {
  const meta = metaNormalizada(m.alvo, m.prazo, faixa);
  const feito = feitoDaMeta(m, todos, faixa, compartilhados);
  const p = meta > 0 ? Math.round((feito / meta) * 100) : feito > 0 ? 100 : 0;
  const total = faixa.ate.getTime() - faixa.de.getTime();
  const frac = faixa.ate <= now ? 1 : Math.min(1, Math.max(0, (now.getTime() - faixa.de.getTime()) / total));
  const esperado = Math.round(meta * frac);
  const status: StatusMeta = p >= 100 ? "ok" : feito >= esperado ? "ok" : feito >= esperado * 0.6 ? "risco" : "atrasado";
  return { id: m.id, userId: m.userId, tipo: m.tipo, rotulo, prazo: m.prazo, meta, feito, p, esperado, status };
}

// ---- Séries ----
export type Ponto = { chave: string; label: string; preenchimento: number; correcao: number };

// Baldes por dia (até 62 dias) ou por semana (segunda a domingo) acima disso.
export function serie(eventos: Evento[], faixa: Faixa): Ponto[] {
  const dias = diasDaFaixa(faixa);
  const semanal = dias > 62;
  const baldes: Ponto[] = [];
  const idx = new Map<string, Ponto>();
  const chaveDe = (d: Date) => {
    const ini = inicioDoDiaBRT(d);
    if (!semanal) return ini;
    const dow = (new Date(ini.getTime() - BRT).getUTCDay() + 6) % 7;
    return new Date(ini.getTime() - dow * DIA);
  };
  const passo = semanal ? 7 * DIA : DIA;
  for (let t = chaveDe(faixa.de).getTime(); t < faixa.ate.getTime(); t += passo) {
    const b = new Date(t);
    const loc = new Date(t - BRT);
    const p: Ponto = {
      chave: loc.toISOString().slice(0, 10),
      label: `${loc.getUTCDate()}/${loc.getUTCMonth() + 1}`,
      preenchimento: 0,
      correcao: 0,
    };
    baldes.push(p);
    idx.set(b.toISOString(), p);
  }
  for (const e of eventos) {
    const p = idx.get(chaveDe(e.quando).toISOString());
    if (p) p[e.tipo] += 1;
  }
  return baldes;
}

export type Contagem = { preenchimento: number; correcao: number; total: number };
const zero = (): Contagem => ({ preenchimento: 0, correcao: 0, total: 0 });
const soma = (c: Contagem, tipo: TipoEvento) => {
  c[tipo] += 1;
  c.total += 1;
};

export function contarPor<K extends string>(eventos: Evento[], chave: (e: Evento) => K | null): Map<K, Contagem> {
  const m = new Map<K, Contagem>();
  for (const e of eventos) {
    const k = chave(e);
    if (!k) continue;
    const c = m.get(k) ?? zero();
    soma(c, e.tipo);
    m.set(k, c);
  }
  return m;
}
export const contarTotal = (eventos: Evento[]): Contagem => {
  const c = zero();
  for (const e of eventos) soma(c, e.tipo);
  return c;
};

export type LinhaPessoa = {
  id: string;
  nome: string;
  producao: Contagem;
  meta: number;
  feitoMeta: number;
  p: number; // % da meta (0 se não tem meta)
  temMeta: boolean;
  status: StatusMeta | null;
  metas: MetaCalc[];
};

export function linhasPorPessoa(
  pessoas: { id: string; nome: string }[],
  eventosFiltrados: Evento[],
  metasCalc: MetaCalc[]
): LinhaPessoa[] {
  const prod = contarPor(eventosFiltrados, (e) => e.pessoaId);
  return pessoas
    .map((u) => {
      const metas = metasCalc.filter((m) => m.userId === u.id);
      const meta = metas.reduce((a, m) => a + m.meta, 0);
      const feitoMeta = metas.reduce((a, m) => a + Math.min(m.feito, m.meta), 0);
      const pior = metas.reduce<StatusMeta | null>((acc, m) => {
        const o = { ok: 0, risco: 1, atrasado: 2 } as const;
        return !acc || o[m.status] > o[acc] ? m.status : acc;
      }, null);
      return {
        id: u.id,
        nome: u.nome,
        producao: prod.get(u.id) ?? zero(),
        meta,
        feitoMeta,
        p: meta > 0 ? Math.round((feitoMeta / meta) * 100) : 0,
        temMeta: metas.length > 0,
        status: pior,
        metas,
      };
    })
    .sort((a, b) => b.producao.total - a.producao.total || a.nome.localeCompare(b.nome));
}

export function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual > 0 ? null : 0;
  return Math.round(((atual - anterior) / anterior) * 100);
}
