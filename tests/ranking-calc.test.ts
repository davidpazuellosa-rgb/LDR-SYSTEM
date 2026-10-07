import test from "node:test";
import assert from "node:assert/strict";
import { montarLinhas, ranquear } from "../src/lib/ranking-calc";

const pessoas = [{ id: "a", nome: "Ana" }, { id: "b", nome: "Bia" }, { id: "c", nome: "Caio" }];
const prod = new Map([["a", { preenchidas: 10, corrigidas: 2 }], ["b", { preenchidas: 3, corrigidas: 0 }]]);
const vals = [
  ...Array.from({ length: 4 }, () => ({ pessoaId: "a", valor: "sim" as const })),
  { pessoaId: "a", valor: "nao" as const },
  ...Array.from({ length: 20 }, () => ({ pessoaId: "b", valor: "sim" as const })),
  ...Array.from({ length: 10 }, () => ({ pessoaId: "b", valor: "nao" as const })),
];

test("linhas: atividades = preenchidas + corrigidas + validadas (Sim+Não); taxa = %Sim", () => {
  const l = montarLinhas(pessoas, prod, vals);
  const a = l.find((x) => x.id === "a")!;
  assert.equal(a.validadas, 5);
  assert.equal(a.atividades, 10 + 2 + 5);
  assert.equal(a.taxa, 80);
  const c = l.find((x) => x.id === "c")!;
  assert.equal(c.atividades, 0);
  assert.equal(c.taxa, null);
});

test("só Sim: validadas e atividades contam apenas os Sim; a taxa continua sobre Sim+Não", () => {
  const b = montarLinhas(pessoas, prod, vals, true).find((x) => x.id === "b")!;
  assert.equal(b.validadas, 20);
  assert.equal(b.atividades, 3 + 20);
  assert.equal(b.taxa, 67);
});

test("ranquear: ordena por métrica, empate por nome, numera", () => {
  const l = montarLinhas(pessoas, prod, vals);
  assert.deepEqual(ranquear(l, "validadas").map((x) => [x.nome, x.posicao]), [["Bia", 1], ["Ana", 2], ["Caio", 3]]);
  assert.deepEqual(ranquear(l, "preenchidas").map((x) => x.nome), ["Ana", "Bia", "Caio"]);
  assert.deepEqual(ranquear(l, "atividades").map((x) => x.nome), ["Bia", "Ana", "Caio"]); // 33 x 17 x 0
});

test("variação contra o período anterior; sem anterior = null", async () => {
  const { variacaoPct } = await import("../src/lib/ranking-calc");
  assert.equal(variacaoPct(120, 100), 20);
  assert.equal(variacaoPct(50, 100), -50);
  assert.equal(variacaoPct(10, 0), null);
  assert.equal(variacaoPct(10, undefined), null);
});

test("privacidade: quem não é admin não recebe Sim/Não/taxa dos colegas, só o próprio", async () => {
  const { ocultarDetalhe } = await import("../src/lib/ranking-calc");
  const l = montarLinhas(pessoas, prod, vals);
  const vistoPorAna = ocultarDetalhe(l, "a", false);
  const ana = vistoPorAna.find((x) => x.id === "a")!;
  const bia = vistoPorAna.find((x) => x.id === "b")!;
  assert.equal(ana.sim, 4);
  assert.equal(ana.taxa, 80);
  assert.equal(bia.sim, 0);
  assert.equal(bia.nao, 0);
  assert.equal(bia.taxa, null);
  assert.equal(bia.oculto, true);
  assert.equal(bia.validadas, 30); // o total continua (é o que o ranking ordena)
  assert.equal(ocultarDetalhe(l, "a", true).find((x) => x.id === "b")!.sim, 20); // admin vê tudo
});

test("ranking por % da meta: ordena por pctMeta e ignora quem não tem meta", async () => {
  const { ranquear } = await import("../src/lib/ranking-calc");
  const l = montarLinhas(pessoas, prod, vals).map((x) => ({ ...x, pctMeta: x.id === "a" ? 80 : x.id === "b" ? 120 : null }));
  const r = ranquear(l.filter((x) => x.pctMeta !== null), "pctMeta");
  assert.deepEqual(r.map((x) => [x.nome, x.valor]), [["Bia", 120], ["Ana", 80]]);
});
