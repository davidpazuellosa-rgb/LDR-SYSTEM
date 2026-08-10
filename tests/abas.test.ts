import test from "node:test";
import assert from "node:assert/strict";
import { parseAbas, foiSemeada, ABAS_KEY, SEMEADA_KEY } from "../src/lib/base-abas";
import { isRowVazia } from "../src/lib/completude";

// ─── Páginas (abas) guardadas em Base.headers ───────────────────────────────

test("parseAbas normaliza para sigla, tira repetido e ignora lixo", () => {
  assert.deepEqual(parseAbas({ [ABAS_KEY]: ["PR", "Rio Grande do Sul", "pr", "", null, "SC"] }), [
    "PR",
    "RS",
    "SC",
  ]);
});

test("parseAbas devolve vazio quando não há abas guardadas", () => {
  assert.deepEqual(parseAbas(null), []);
  assert.deepEqual(parseAbas({}), []);
  assert.deepEqual(parseAbas({ [ABAS_KEY]: "PR" }), []); // não é array
});

test("parseAbas convive com as outras chaves reservadas", () => {
  const headers = { cidade: "Município", __cols__: [{ key: "c_x", label: "X" }], [ABAS_KEY]: ["MG"] };
  assert.deepEqual(parseAbas(headers), ["MG"]);
});

test("foiSemeada só é verdadeiro com a marca explícita", () => {
  assert.equal(foiSemeada(null), false);
  assert.equal(foiSemeada({}), false);
  assert.equal(foiSemeada({ [SEMEADA_KEY]: true }), true);
  assert.equal(foiSemeada({ [SEMEADA_KEY]: "sim" }), false);
});

// ─── Linha vazia (não conta nos contadores de progresso) ────────────────────

test("linha recém-criada é vazia, mesmo com o andaime da página", () => {
  assert.equal(isRowVazia({}), true);
  assert.equal(isRowVazia({ cidade: null, telefonePrefeitura: null }), true);
  // estado/região são o andaime da aba em que a linha nasceu, não dado digitado
  assert.equal(isRowVazia({ estado: "PR", regiao: "Sul" }), true);
  assert.equal(isRowVazia({ cidade: "   " }), true); // só espaço em branco
});

test("qualquer dado real tira a linha do estado vazio", () => {
  assert.equal(isRowVazia({ cidade: "Curitiba" }), false);
  assert.equal(isRowVazia({ estado: "PR", telefonePrefeitura: "(41) 3350-8484" }), false);
});

test("valor de coluna personalizada também conta como dado", () => {
  assert.equal(isRowVazia({ estado: "PR" }, { c_ouvidoria: "" }), true);
  assert.equal(isRowVazia({ estado: "PR" }, { c_ouvidoria: "  " }), true);
  assert.equal(isRowVazia({ estado: "PR" }, { c_ouvidoria: "1234" }), false);
});

test("campos que não são de dado (id/baseId/status) não impedem de ser vazia", () => {
  const linha = { id: "abc", baseId: "base1", status: "ok", createdAt: "2026-01-01", estado: "PR" };
  assert.equal(isRowVazia(linha), true);
});
