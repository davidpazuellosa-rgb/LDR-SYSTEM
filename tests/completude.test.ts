import { test } from "node:test";
import assert from "node:assert/strict";
import { isRowCompleta, isRowVazia, valorDaCelula } from "../src/lib/completude";
import { CONTACT_FIELD_KEYS, CONTACT_FIELD_SELECT } from "../src/lib/contact-fields";

// O select do Prisma é escrito à mão (o Prisma só infere tipos a partir de um
// literal), então precisa acompanhar CONTACT_FIELDS — este teste é o alarme.
test("CONTACT_FIELD_SELECT cobre exatamente as colunas fixas", () => {
  assert.deepEqual(Object.keys(CONTACT_FIELD_SELECT).sort(), [...CONTACT_FIELD_KEYS].sort());
});

test("valorDaCelula lê tanto coluna fixa quanto personalizada", () => {
  const row = { cidade: "Curitiba", estado: null };
  const custom = { c_abc: "valor" };
  assert.equal(valorDaCelula("cidade", row, custom), "Curitiba");
  assert.equal(valorDaCelula("c_abc", row, custom), "valor");
  // Campo fixo nulo e chave inexistente caem no vazio (e não em undefined).
  assert.equal(valorDaCelula("estado", row, custom), "");
  assert.equal(valorDaCelula("naoExiste", row, custom), "");
});

test("linha só é completa com TODAS as colunas visíveis preenchidas", () => {
  const cols = ["cidade", "estado", "c_obs"];
  const cheia = { cidade: "Curitiba", estado: "PR" };
  assert.equal(isRowCompleta(cols, cheia, { c_obs: "ok" }), true);
  // Falta a personalizada.
  assert.equal(isRowCompleta(cols, cheia, {}), false);
  // Falta uma fixa.
  assert.equal(isRowCompleta(cols, { cidade: "Curitiba", estado: "  " }, { c_obs: "ok" }), false);
});

test("coluna oculta/excluída deixa de ser exigida", () => {
  const row = { cidade: "Curitiba", estado: "PR" };
  // Enquanto c_obs está na régua, a linha está incompleta...
  assert.equal(isRowCompleta(["cidade", "estado", "c_obs"], row, {}), false);
  // ...e ao sair da régua (coluna oculta/excluída), a mesma linha fica completa.
  assert.equal(isRowCompleta(["cidade", "estado"], row, {}), true);
});

test("coluna nova entra na régua e desfaz a conclusão até ser preenchida", () => {
  const row = { cidade: "Curitiba", estado: "PR" };
  assert.equal(isRowCompleta(["cidade", "estado"], row, {}), true);
  assert.equal(isRowCompleta(["cidade", "estado", "c_novo"], row, {}), false);
  assert.equal(isRowCompleta(["cidade", "estado", "c_novo"], row, { c_novo: "x" }), true);
});

test("planilha sem colunas não dá tudo como concluído", () => {
  // Régua vazia seria "todas as (zero) colunas preenchidas" = verdade à toa.
  assert.equal(isRowCompleta([], { cidade: "Curitiba" }, {}), false);
});

test("linha em branco nunca conta como concluída", () => {
  const vazia = { cidade: "", estado: "PR", regiao: "Sul" };
  // estado/regiao são só o andaime da página, não dado digitado.
  assert.equal(isRowVazia(vazia, {}), true);
  assert.equal(isRowCompleta(["estado", "regiao"], vazia, {}), false);
});
