import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrarColunas, EXPORT_COLS } from "../src/lib/export-cols";

const rows = [["A", "B", "C"], [1, 2, 3]];

test("sem ?cols devolve tudo", () => {
  assert.deepEqual(filtrarColunas(rows, null), rows);
});
test("?cols filtra por índice e mantém a ordem pedida", () => {
  assert.deepEqual(filtrarColunas(rows, "0,2"), [["A", "C"], [1, 3]]);
});
test("índices inválidos/fora do alcance são ignorados; lista vazia = tudo", () => {
  assert.deepEqual(filtrarColunas(rows, "1,9,x,-1"), [["B"], [2]]);
  assert.deepEqual(filtrarColunas(rows, ""), rows);
});
test("rótulos do popup têm o mesmo tamanho dos cabeçalhos das rotas", () => {
  assert.equal(EXPORT_COLS.pessoas.length, 8);
  assert.equal(EXPORT_COLS.detalhe.length, 8);
  assert.equal(EXPORT_COLS.metas.length, 7);
  assert.equal(EXPORT_COLS.producao.length, 5);
});
