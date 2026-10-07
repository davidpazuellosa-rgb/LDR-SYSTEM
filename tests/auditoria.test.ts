import test from "node:test";
import assert from "node:assert/strict";
import { avaliarSuspeitos, LIMITE_POR_HORA, LIMITE_POR_DIA } from "../src/lib/auditoria";

const h = (n: number) => new Date(Date.UTC(2026, 9, 7, n));

test("pessoa normal (poucos créditos) não é suspeita", () => {
  assert.deepEqual(avaliarSuspeitos([{ pessoaId: "a", nome: "Ana", hora: h(10), qtd: 20 }, { pessoaId: "a", nome: "Ana", hora: h(11), qtd: 25 }]), []);
});

test("muitos créditos numa hora = suspeito", () => {
  const r = avaliarSuspeitos([{ pessoaId: "a", nome: "Ana", hora: h(10), qtd: LIMITE_POR_HORA }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].picoHora, LIMITE_POR_HORA);
});

test("muitos créditos no dia, mesmo espalhados, = suspeito; ordena do maior para o menor", () => {
  const horas = Array.from({ length: 8 }, (_, i) => ({ pessoaId: "b", nome: "Bia", hora: h(8 + i), qtd: Math.ceil(LIMITE_POR_DIA / 8) + 1 }));
  const r = avaliarSuspeitos([...horas, { pessoaId: "c", nome: "Caio", hora: h(9), qtd: 60 }]);
  assert.equal(r.length, 1); // Caio fez 60 numa hora só: abaixo dos limites; Bia passa pelo total do dia
  assert.equal(r[0].nome, "Bia");
  assert.ok(r[0].total24h >= LIMITE_POR_DIA);
});
