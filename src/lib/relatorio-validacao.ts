// Aba "Validação" dos Relatórios: por planilha validada (estado atual + o que foi validado
// no período) e, para o admin, por pessoa. O LDR só recebe o que é DELE.
// SEGURANÇA: o `viewer` vem da sessão; para quem não é admin nenhum dado de outra pessoa
// sai daqui (nem nomes, nem contagens).
import { prisma } from "@/lib/prisma";
import { isRowVazia, tipoOrgao } from "@/lib/completude";
import { calcularHorarios } from "@/lib/horarios";
import { carregarValidacoes } from "@/lib/validacoes-carga";
import { colunaValidacao, validacaoAtiva, valorDeValidacao } from "@/lib/validacao";
import { faixaAnterior, faixaDoPeriodo, parsePreset } from "@/lib/producao-calc";
import { ensureContactCustomTable } from "@/lib/custom-columns";

export type ParamsValidacao = { periodo?: string; de?: string; ate?: string };

export type LinhaPlanilha = {
  baseId: string; nome: string; orgao: string;
  total: number; sim: number; nao: number; aValidar: number; pctValidada: number; // estado atual
  noPeriodo: { sim: number; nao: number }; // validado no período (do visualizador, se não admin)
  top: { nome: string; n: number } | null; // quem mais validou no período (só admin)
};
export type LinhaPessoaVal = { id: string; nome: string; sim: number; nao: number; total: number; taxa: number | null; planilhas: number };

const taxaDe = (sim: number, nao: number) => (sim + nao > 0 ? Math.round((sim / (sim + nao)) * 100) : null);

export async function buildRelatorioValidacao(sp: ParamsValidacao, viewer: { id: string; admin: boolean }) {
  const preset = parsePreset(sp.periodo);
  const faixa = faixaDoPeriodo(preset, new Date(), sp.de, sp.ate);
  const anterior = faixaAnterior(faixa);

  const bases = await prisma.base.findMany({ select: { id: true, name: true, headers: true } });
  const validadas = bases.filter((b) => validacaoAtiva(b.headers as Record<string, unknown> | null));
  const chaveDe = new Map(validadas.map((b) => [b.id, colunaValidacao(b.headers as Record<string, unknown> | null)?.key || ""]));

  // Estado atual: contatos (não vazios, não excluídos) das planilhas validadas + valor Sim/Não/–.
  const idsBases = validadas.map((b) => b.id);
  const contatos = idsBases.length
    ? await prisma.contact.findMany({
        where: { deletedAt: null, baseId: { in: idsBases } },
        select: { id: true, baseId: true, cidade: true, telefonePrefeitura: true, emailInstitucional: true, nomePrefeito: true, whatsapp: true, siteOficial: true },
      })
    : [];
  const customPorContato = new Map<string, Record<string, string>>();
  if (contatos.length) {
    await ensureContactCustomTable();
    const cv = await prisma.contactCustomValue.findMany({ where: { contactId: { in: contatos.map((c) => c.id) } }, select: { contactId: true, colKey: true, valor: true } });
    for (const r of cv) (customPorContato.get(r.contactId) ?? customPorContato.set(r.contactId, {}).get(r.contactId)!)[r.colKey] = r.valor ?? "";
  }
  const estado = new Map<string, { total: number; sim: number; nao: number }>();
  for (const c of contatos) {
    const cust = customPorContato.get(c.id);
    const semValidacao = cust ? Object.fromEntries(Object.entries(cust).filter(([k]) => k !== chaveDe.get(c.baseId))) : undefined;
    if (isRowVazia(c as unknown as Record<string, unknown>, semValidacao)) continue;
    const e = estado.get(c.baseId) ?? { total: 0, sim: 0, nao: 0 };
    e.total++;
    const v = valorDeValidacao(cust?.[chaveDe.get(c.baseId) || ""]);
    if (v === "sim") e.sim++;
    else if (v === "nao") e.nao++;
    estado.set(c.baseId, e);
  }

  // Validações do período (com pessoa) e do período anterior (comparação).
  const [atuais, previas] = await Promise.all([carregarValidacoes(faixa.de, faixa.ate), carregarValidacoes(anterior.de, anterior.ate)]);
  const nomes = new Map<string, string>();
  const idsPessoas = [...new Set(atuais.map((v) => v.porId!).filter(Boolean))];
  if (viewer.admin && idsPessoas.length) {
    const us = await prisma.user.findMany({ where: { id: { in: idsPessoas } }, select: { id: true, name: true, email: true } });
    for (const u of us) nomes.set(u.id, u.name || u.email);
  }
  const meus = (lista: typeof atuais) => lista.filter((v) => v.porId === viewer.id);
  const visiveis = viewer.admin ? atuais : meus(atuais);

  const planilhas: LinhaPlanilha[] = validadas.map((b) => {
    const e = estado.get(b.id) ?? { total: 0, sim: 0, nao: 0 };
    const doPeriodo = visiveis.filter((v) => v.baseId === b.id);
    const por = new Map<string, number>();
    if (viewer.admin) for (const v of doPeriodo) por.set(v.porId!, (por.get(v.porId!) ?? 0) + 1);
    const topId = [...por].sort((x, y) => y[1] - x[1])[0];
    return {
      baseId: b.id, nome: b.name, orgao: tipoOrgao(b.name),
      total: e.total, sim: e.sim, nao: e.nao, aValidar: e.total - e.sim - e.nao,
      pctValidada: e.total > 0 ? Math.round(((e.sim + e.nao) / e.total) * 100) : 0,
      noPeriodo: { sim: doPeriodo.filter((v) => v.valor === "sim").length, nao: doPeriodo.filter((v) => v.valor === "nao").length },
      top: topId ? { nome: nomes.get(topId[0]) || "—", n: topId[1] } : null,
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome));

  // Por pessoa: só o admin recebe a lista da equipe.
  let pessoas: LinhaPessoaVal[] | null = null;
  if (viewer.admin) {
    const m = new Map<string, { sim: number; nao: number; bases: Set<string> }>();
    for (const v of atuais) {
      const x = m.get(v.porId!) ?? { sim: 0, nao: 0, bases: new Set<string>() };
      if (v.valor === "sim") x.sim++; else x.nao++;
      x.bases.add(v.baseId);
      m.set(v.porId!, x);
    }
    pessoas = [...m].map(([id, x]) => ({ id, nome: nomes.get(id) || "—", sim: x.sim, nao: x.nao, total: x.sim + x.nao, taxa: taxaDe(x.sim, x.nao), planilhas: x.bases.size }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
  }

  const soma = (l: { valor: "sim" | "nao" }[]) => ({ sim: l.filter((v) => v.valor === "sim").length, nao: l.filter((v) => v.valor === "nao").length });
  const cur = soma(viewer.admin ? atuais : meus(atuais));
  const prev = soma(viewer.admin ? previas : meus(previas));
  return {
    preset, de: sp.de || null, ate: sp.ate || null,
    faixa: { de: faixa.de.toISOString(), ate: faixa.ate.toISOString() },
    admin: viewer.admin,
    planilhas, pessoas,
    resumo: { ...cur, total: cur.sim + cur.nao, taxa: taxaDe(cur.sim, cur.nao), totalAnterior: prev.sim + prev.nao },
    horarios: calcularHorarios(visiveis.map((v) => v.concluidoEm), "validacao"),
  };
}
export type RelatorioValidacao = Awaited<ReturnType<typeof buildRelatorioValidacao>>;
