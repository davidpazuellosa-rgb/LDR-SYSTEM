// Carrega do banco os dados do relatório "Produção por pessoa" e monta o que a tela usa.
import { prisma } from "@/lib/prisma";
import { OPERATOR_ROLES } from "@/lib/permissions";
import { tipoOrgao } from "@/lib/completude";
import { ufSigla } from "@/lib/uf";
import { isCampanhaAtiva } from "@/lib/campanhas";
import { ensureMetaTable } from "@/lib/meta";
import { ensureContactFillTable } from "@/lib/contact-fill";
import {
  calcularMeta, contarPor, contarTotal, faixaAnterior, faixaDoPeriodo, filtrarEventos, filtrarMetas,
  linhasPorPessoa, parsePreset, serie, variacao,
  type Evento, type Filtros, type MetaIn, type Preset,
} from "@/lib/producao-calc";

export type ParamsProducao = {
  periodo?: string;
  de?: string;
  ate?: string;
  orgao?: string;
  regioes?: string;
  estados?: string;
  pessoas?: string;
  campanhas?: string;
  tipo?: string;
};

const lista = (v?: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

export function parseFiltros(sp: ParamsProducao) {
  const preset: Preset = parsePreset(sp.periodo);
  const filtros: Filtros = {
    orgao: sp.orgao || null,
    regioes: lista(sp.regioes),
    estados: lista(sp.estados),
    pessoas: lista(sp.pessoas),
    campanhas: lista(sp.campanhas),
    tipo: sp.tipo === "preenchimento" || sp.tipo === "correcao" ? sp.tipo : "tudo",
  };
  return { preset, de: sp.de || null, ate: sp.ate || null, filtros };
}

export async function buildProducao(sp: ParamsProducao, opts: { grupos?: boolean } = {}) {
  const { preset, de, ate, filtros } = parseFiltros(sp);
  const now = new Date();
  const faixa = faixaDoPeriodo(preset, now, de, ate);
  const anterior = faixaAnterior(faixa);
  const desde = new Date(Math.min(faixa.de.getTime(), anterior.de.getTime()));

  await ensureMetaTable();
  await ensureContactFillTable();

  const [pessoasDb, metasDb, bases, fillRows, corrRows] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: OPERATOR_ROLES } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.meta.findMany(),
    prisma.base.findMany({ select: { id: true, name: true } }),
    prisma.contactFill.findMany({ where: { concluidoEm: { gte: desde, lt: faixa.ate } }, select: { contactId: true, preenchidoPorId: true, concluidoEm: true } }),
    prisma.correction.findMany({
      where: { status: "resolved", resolvedAt: { gte: desde, lt: faixa.ate }, resolvedById: { not: null } },
      select: { resolvedById: true, resolvedAt: true, contact: { select: { baseId: true, regiao: true, estado: true, campanha: true } } },
    }),
  ]);

  const orgaoDaBase = new Map(bases.map((b) => [b.id, tipoOrgao(b.name)]));
  const nomeBase = new Map(bases.map((b) => [b.id, b.name]));

  const ids = Array.from(new Set(fillRows.map((f) => f.contactId)));
  const contatos = ids.length
    ? await prisma.contact.findMany({ where: { id: { in: ids } }, select: { id: true, baseId: true, regiao: true, estado: true, campanha: true } })
    : [];
  const porId = new Map(contatos.map((c) => [c.id, c]));

  const todos: Evento[] = [];
  for (const f of fillRows) {
    const c = porId.get(f.contactId);
    if (!c) continue;
    todos.push({
      tipo: "preenchimento", pessoaId: f.preenchidoPorId, quando: f.concluidoEm, baseId: c.baseId,
      orgao: orgaoDaBase.get(c.baseId) || "Órgão", regiao: (c.regiao && c.regiao.trim()) || null,
      estado: ufSigla(c.estado) || null, campanha: c.campanha,
    });
  }
  for (const r of corrRows) {
    if (!r.resolvedAt || !r.resolvedById) continue;
    todos.push({
      tipo: "correcao", pessoaId: r.resolvedById, quando: r.resolvedAt, baseId: r.contact.baseId,
      orgao: orgaoDaBase.get(r.contact.baseId) || "Órgão", regiao: (r.contact.regiao && r.contact.regiao.trim()) || null,
      estado: ufSigla(r.contact.estado) || null, campanha: r.contact.campanha,
    });
  }

  const pessoas = pessoasDb.map((u) => ({ id: u.id, nome: u.name || u.email }));
  const pessoasVisiveis = filtros.pessoas.length ? pessoas.filter((p) => filtros.pessoas.includes(p.id)) : pessoas;

  const metas: MetaIn[] = metasDb.map((m) => ({
    id: m.id, userId: m.userId, tipo: m.tipo, baseId: m.baseId, regiao: m.regiao, estado: m.estado,
    campanha: m.campanha, prazo: m.prazo, alvo: m.alvo, orgao: m.tipo === "correcao" ? "" : orgaoDaBase.get(m.baseId || "") || "Órgão",
  }));
  const rotulo = (m: MetaIn) =>
    m.tipo === "correcao" ? `Campanha: ${m.campanha || "—"}` : `${m.orgao} · ${m.regiao || "—"} · ${ufSigla(m.estado) || m.estado || "—"}`;
  const metasCalc = filtrarMetas(metas, filtros).map((m) => calcularMeta(m, todos, faixa, now, rotulo(m)));

  const atuais = filtrarEventos(todos, filtros, faixa);
  const previos = filtrarEventos(todos, filtros, anterior);
  const total = contarTotal(atuais);
  const totalPrev = contarTotal(previos);

  const linhas = linhasPorPessoa(pessoasVisiveis, atuais, metasCalc);
  const dias = serie(atuais, faixa);

  const porEstado = Array.from(contarPor(atuais, (e) => e.estado).entries())
    .map(([uf, c]) => ({ uf, ...c }))
    .sort((a, b) => b.total - a.total);
  const porCampanha = Array.from(contarPor(atuais, (e) => (e.campanha || "").trim() || null).entries())
    .map(([campanha, c]) => ({ campanha, ...c }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  // Detalhe por pessoa (painel lateral): dia, estado, campanha e metas.
  const detalhe: Record<string, {
    dias: ReturnType<typeof serie>;
    estados: { uf: string; preenchimento: number; correcao: number; total: number }[];
    campanhas: { campanha: string; preenchimento: number; correcao: number; total: number }[];
  }> = {};
  for (const p of pessoasVisiveis) {
    const ev = atuais.filter((e) => e.pessoaId === p.id);
    detalhe[p.id] = {
      dias: serie(ev, faixa),
      estados: Array.from(contarPor(ev, (e) => e.estado).entries()).map(([uf, c]) => ({ uf, ...c })).sort((a, b) => b.total - a.total),
      campanhas: Array.from(contarPor(ev, (e) => (e.campanha || "").trim() || null).entries())
        .map(([campanha, c]) => ({ campanha, ...c })).sort((a, b) => b.total - a.total),
    };
  }

  const metasBatidas = metasCalc.filter((m) => m.p >= 100).length;
  const somaMeta = metasCalc.reduce((a, m) => a + m.meta, 0);
  const somaFeito = metasCalc.reduce((a, m) => a + Math.min(m.feito, m.meta), 0);

  // Opções dos filtros (árvore órgão → região → estados, a partir das bases/contatos).
  const pares = await prisma.contact.findMany({
    where: { deletedAt: null },
    select: { baseId: true, regiao: true, estado: true },
    distinct: ["baseId", "regiao", "estado"],
  });
  const arvore: Record<string, Record<string, string[]>> = {};
  for (const p of pares) {
    const org = orgaoDaBase.get(p.baseId);
    const uf = ufSigla(p.estado);
    if (!org || !uf) continue;
    const reg = (p.regiao && p.regiao.trim()) || "Sem região";
    const ufs = ((arvore[org] ||= {})[reg] ||= []);
    if (!ufs.includes(uf)) ufs.push(uf);
  }
  for (const org of Object.values(arvore)) for (const reg of Object.keys(org)) org[reg].sort();
  const campanhasOpcoes = Array.from(
    new Set((await prisma.contact.findMany({ where: { deletedAt: null }, select: { campanha: true }, distinct: ["campanha"] })).map((c) => (c.campanha || "").trim()).filter((c) => isCampanhaAtiva(c)))
  ).sort();

  // Só para a exportação detalhada: contagem por pessoa × dia × tipo × território × campanha.
  const nomeDe = new Map(pessoas.map((p) => [p.id, p.nome]));
  const grupos: { pessoa: string; dia: string; tipo: string; orgao: string; regiao: string; estado: string; campanha: string; qtd: number }[] = [];
  if (opts.grupos) {
    const m = new Map<string, (typeof grupos)[number]>();
    for (const e of atuais) {
      const dia = new Date(e.quando.getTime() - 3 * 3600000).toISOString().slice(0, 10);
      const g = { pessoa: nomeDe.get(e.pessoaId) || e.pessoaId, dia, tipo: e.tipo, orgao: e.orgao, regiao: e.regiao || "Sem região", estado: e.estado || "", campanha: (e.campanha || "").trim(), qtd: 0 };
      const k = Object.values({ ...g, qtd: "" }).join("|");
      const cur = m.get(k) ?? g;
      cur.qtd += 1;
      m.set(k, cur);
    }
    grupos.push(...[...m.values()].sort((a, b) => a.dia.localeCompare(b.dia) || a.pessoa.localeCompare(b.pessoa)));
  }

  return {
    grupos,
    preset, de, ate, filtros,
    faixa: { de: faixa.de.toISOString(), ate: faixa.ate.toISOString() },
    kpis: {
      total, totalPrev,
      varTotal: variacao(total.total, totalPrev.total),
      varPreench: variacao(total.preenchimento, totalPrev.preenchimento),
      varCorr: variacao(total.correcao, totalPrev.correcao),
      metasBatidas, totalMetas: metasCalc.length,
      pctMetas: somaMeta > 0 ? Math.round((somaFeito / somaMeta) * 100) : null,
    },
    linhas, dias, porEstado, porCampanha, detalhe, metasCalc,
    opcoes: { pessoas, arvore, campanhas: campanhasOpcoes, orgaos: Object.keys(arvore).sort() },
    nomeBase: Object.fromEntries(nomeBase),
  };
}

export type Producao = Awaited<ReturnType<typeof buildProducao>>;
