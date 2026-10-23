import test from "node:test";
import assert from "node:assert/strict";
import { precisaAtualizar } from "../src/lib/versao";

test("avisa só quando o servidor devolve uma versão válida e diferente da carregada", () => {
  assert.equal(precisaAtualizar("abc", "xyz"), true);
  assert.equal(precisaAtualizar("abc", "abc"), false);
});

test("não alarma por resposta vazia, erro ou formato inesperado", () => {
  for (const ruim of [undefined, null, "", 0, {}, [], false]) assert.equal(precisaAtualizar("abc", ruim), false);
});

test("em desenvolvimento ('dev') nunca avisa", () => {
  assert.equal(precisaAtualizar("dev", "xyz"), false);
  assert.equal(precisaAtualizar("abc", "dev"), false);
});
