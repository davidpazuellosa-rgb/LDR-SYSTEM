import { test } from "node:test";
import assert from "node:assert/strict";
import {
  faixaDoPeriodo, faixaAnterior, diasDaFaixa, metaNormalizada, filtrarEventos, filtrarMetas,
  calcularMeta, serie, linhasPorPessoa, contarTotal, variacao, type Evento, type EventoVal, type MetaIn, type Filtros,
} from "../src/lib/producao-calc";

const F0: Filtros = { orgao: null, regioes: [], estados: [], pessoas: [], campanhas: [], tipo: "tudo" };
// 2026-09-25 15:00 UTC = 12:00 em Brasília
const now = new Date("2026-09-25T15:00:00Z");
const ev = (o: Partial<Evento>): Evento => ({
  tipo: "preenchimento", pessoaId: "a", quando: new Date("2026-09-25T12:00:00Z"), baseId: "b1",
  orgao: "Prefeitura", regiao: "Nordeste", estado: "AL", campanha: null, ...o,
});

test("períodos em horário de Brasília", () => {
  const h = faixaDoPeriodo("hoje", now);
  assert.equal(h.de.toISOString(), "2026-09-25T03:00:00.000Z");
  assert.equal(diasDaFaixa(h), 1);
  assert.equal(diasDaFaixa(faixaDoPeriodo("7d", now)), 7);
  assert.equal(diasDaFaixa(faixaDoPeriodo("30d", now)), 30);
  assert.equal(diasDaFaixa(faixaDoPeriodo("mes", now)), 30);
  assert.equal(diasDaFaixa(faixaDoPeriodo("mes-passado", now)), 31);
});

test("período personalizado inclui o último dia", () => {
  const f = faixaDoPeriodo("personalizado", now, "2026-09-01", "2026-09-10");
  assert.equal(diasDaFaixa(f), 10);
  assert.equal(diasDaFaixa(faixaDoPeriodo("personalizado", now, "2026-09-05", "2026-09-01")), 1); // fim antes do início
});

test("faixa anterior tem o mesmo tamanho e termina onde a atual começa", () => {
  const f = faixaDoPeriodo("7d", now);
  const p = faixaAnterior(f);
  assert.equal(p.ate.getTime(), f.de.getTime());
  assert.equal(diasDaFaixa(p), 7);
});

test("meta é proporcional ao período", () => {
  const f14 = { de: new Date("2026-09-01T03:00:00Z"), ate: new Date("2026-09-15T03:00:00Z") };
  assert.equal(metaNormalizada(10, "semanal", f14), 20);
  assert.equal(metaNormalizada(2, "diaria", f14), 28);
  assert.equal(metaNormalizada(30, "mensal", f14), 14);
});

test("filtros: pessoa, estado, região, tipo e período", () => {
  const faixa = faixaDoPeriodo("7d", now);
  const evs = [
    ev({}), ev({ pessoaId: "b" }), ev({ estado: "BA" }), ev({ regiao: "Sul", estado: "RS" }),
    ev({ tipo: "correcao", campanha: "X" }), ev({ quando: new Date("2026-01-01T00:00:00Z") }),
  ];
  assert.equal(filtrarEventos(evs, F0, faixa).length, 5);
  assert.equal(filtrarEventos(evs, { ...F0, pessoas: ["b"] }, faixa).length, 1);
  assert.equal(filtrarEventos(evs, { ...F0, estados: ["AL", "BA"] }, faixa).length, 4);
  assert.equal(filtrarEventos(evs, { ...F0, regioes: ["Sul"] }, faixa).length, 1);
  assert.equal(filtrarEventos(evs, { ...F0, tipo: "correcao" }, faixa).length, 1);
  assert.equal(filtrarEventos(evs, { ...F0, campanhas: ["x"] }, faixa).length, 1);
});

const metaP: MetaIn = { id: "m1", userId: "a", tipo: "preenchimento", baseId: "b1", regiao: "Nordeste", estado: "AL", campanha: null, prazo: "semanal", alvo: 10, orgao: "Prefeitura" };
const metaC: MetaIn = { id: "m2", userId: "a", tipo: "correcao", baseId: null, regiao: null, estado: null, campanha: "X", prazo: "semanal", alvo: 5, orgao: "" };

test("filtrar metas: território esconde correção; campanha esconde preenchimento", () => {
  assert.equal(filtrarMetas([metaP, metaC], F0).length, 2);
  assert.equal(filtrarMetas([metaP, metaC], { ...F0, estados: ["AL"] }).length, 1);
  assert.equal(filtrarMetas([metaP, metaC], { ...F0, campanhas: ["X"] }).length, 1);
  assert.equal(filtrarMetas([metaP, metaC], { ...F0, pessoas: ["z"] }).length, 0);
});

test("meta: preenchimento conta tudo que a pessoa completou (fora do território vai em `fora`); correção só de quem resolveu", () => {
  const faixa = faixaDoPeriodo("7d", now);
  const todos = [ev({ pessoaId: "outro" }), ev({}), ev({ estado: "BA" }), ev({ tipo: "correcao", campanha: "X" }), ev({ tipo: "correcao", pessoaId: "outro", campanha: "X" })];
  const p = calcularMeta(metaP, todos, faixa, now, "P");
  assert.equal(p.meta, 10);
  assert.equal(p.feito, 2); // AL + BA da pessoa "a"; o da pessoa "outro" não conta
  assert.equal(p.fora, 1); // o de BA
  assert.equal(p.p, 20);
  const c = calcularMeta(metaC, todos, faixa, now, "C");
  assert.equal(c.feito, 1);
});

test("status: período encerrado usa só o percentual; em andamento usa o ritmo", () => {
  const passado = faixaDoPeriodo("mes-passado", now);
  const evs = Array.from({ length: 4 }, () => ev({ quando: new Date("2026-08-10T15:00:00Z") }));
  assert.equal(calcularMeta({ ...metaP, prazo: "mensal", alvo: 10 }, evs, passado, now, "").status, "atrasado"); // 40%
  const cheio = Array.from({ length: 10 }, () => ev({ quando: new Date("2026-08-10T15:00:00Z") }));
  assert.equal(calcularMeta({ ...metaP, prazo: "mensal", alvo: 10 }, cheio, passado, now, "").status, "ok");
});

test("série diária cobre todos os dias, mesmo os vazios, e separa os tipos", () => {
  const faixa = faixaDoPeriodo("7d", now);
  const s = serie([ev({}), ev({}), ev({ tipo: "correcao" })], faixa);
  assert.equal(s.length, 7);
  assert.equal(s[6].preenchimento, 2);
  assert.equal(s[6].correcao, 1);
  assert.equal(s[0].preenchimento + s[0].correcao, 0);
});

test("série vira semanal em períodos longos", () => {
  const f = faixaDoPeriodo("personalizado", now, "2026-01-01", "2026-09-25");
  assert.ok(serie([], f).length < 45);
});

test("linhas por pessoa: total da equipe = soma, pessoa sem meta fica sem %", () => {
  const faixa = faixaDoPeriodo("7d", now);
  const evs = [ev({}), ev({}), ev({ pessoaId: "b", tipo: "correcao" })];
  const mc = [calcularMeta(metaP, evs, faixa, now, "P")];
  const linhas = linhasPorPessoa([{ id: "a", nome: "Ana" }, { id: "b", nome: "Bia" }, { id: "c", nome: "Caio" }], evs, mc);
  assert.equal(linhas[0].id, "a");
  assert.equal(linhas[0].producao.total, 2);
  assert.equal(linhas[0].temMeta, true);
  assert.equal(linhas[1].temMeta, false);
  assert.equal(linhas.reduce((a, l) => a + l.producao.total, 0), contarTotal(evs).total);
});

test("variação percentual", () => {
  assert.equal(variacao(15, 10), 50);
  assert.equal(variacao(5, 10), -50);
  assert.equal(variacao(3, 0), null);
  assert.equal(variacao(0, 0), 0);
});

test("meta de validação (Produção por pessoa): conta Sim+Não da pessoa; só Sim filtra; fora = outra planilha", () => {
  const faixa = faixaDoPeriodo("7d", now);
  const meta: MetaIn = { id: "mv", userId: "a", tipo: "validacao", baseId: "b1", regiao: "Nordeste", estado: "*", campanha: null, prazo: "semanal", alvo: 10, orgao: "Prefeitura" };
  const v = (o: Partial<EventoVal>): EventoVal => ({ pessoaId: "a", quando: new Date("2026-09-25T12:00:00Z"), baseId: "b1", orgao: "Prefeitura", regiao: "Nordeste", estado: "AL", valor: "sim", ...o });
  const vals = [v({}), v({ valor: "nao" }), v({ baseId: "b2" }), v({ pessoaId: "outro" })];
  const c = calcularMeta(meta, [], faixa, now, "V", undefined, vals);
  assert.equal(c.feito, 3);
  assert.equal(c.sim, 2);
  assert.equal(c.nao, 1);
  assert.equal(c.fora, 1);
  assert.equal(calcularMeta(meta, [], faixa, now, "V", undefined, vals, true).feito, 2);
  // filtro "só preenchimento" não mostra meta de validação
  assert.equal(filtrarMetas([meta], { ...F0, tipo: "preenchimento" }).length, 0);
  assert.equal(filtrarMetas([meta], F0).length, 1);
});
