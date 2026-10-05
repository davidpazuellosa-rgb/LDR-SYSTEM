import { test } from "node:test";
import assert from "node:assert/strict";
import { nomePaginaValido, parsePaginas, MAX_PAGINAS } from "../src/lib/base-abas";
import { isRowVazia } from "../src/lib/completude";

test("nome de página: aparado, até 40 caracteres, sem '__' no início", () => {
  assert.equal(nomePaginaValido("  Capitais   do   Norte "), "Capitais do Norte");
  assert.equal(nomePaginaValido("x".repeat(80))?.length, 40);
  assert.equal(nomePaginaValido(""), null);
  assert.equal(nomePaginaValido("   "), null);
  assert.equal(nomePaginaValido("__reservado"), null);
});

test("parsePaginas: tira repetidas (sem diferenciar maiúsculas), inválidas e respeita o limite", () => {
  assert.deepEqual(parsePaginas({ __paginas__: ["Capitais", "capitais", "", "__x", "Revisar"] }), ["Capitais", "Revisar"]);
  assert.deepEqual(parsePaginas({}), []);
  assert.deepEqual(parsePaginas(null), []);
  const muitas = Array.from({ length: 80 }, (_, i) => `P${i}`);
  assert.equal(parsePaginas({ __paginas__: muitas }).length, MAX_PAGINAS);
});

test("a página da linha (__pagina__) NÃO conta como dado: linha em branco continua vazia", () => {
  assert.equal(isRowVazia({}, { __pagina__: "Capitais" }), true);
  assert.equal(isRowVazia({}, { __pagina__: "Capitais", c_obs: "algo" }), false);
});
