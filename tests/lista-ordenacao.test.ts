import test from "node:test";
import assert from "node:assert/strict";
import { proximaOrd } from "../src/components/ListaUtils";

test("ordenação por clique no cabeçalho: crescente → decrescente → volta ao padrão", () => {
  const a = proximaOrd(null, "nome");
  assert.deepEqual(a, { k: "nome", dir: 1 });
  const b = proximaOrd(a, "nome");
  assert.deepEqual(b, { k: "nome", dir: -1 });
  assert.equal(proximaOrd(b, "nome"), null);
});

test("clicar em outra coluna recomeça pelo crescente", () => {
  assert.deepEqual(proximaOrd({ k: "nome", dir: -1 }, "pct"), { k: "pct", dir: 1 });
});
