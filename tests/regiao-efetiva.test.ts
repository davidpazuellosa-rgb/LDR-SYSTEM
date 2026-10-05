import { test } from "node:test";
import assert from "node:assert/strict";
import { regiaoEfetiva, regiaoDoNomeDaBase } from "../src/lib/completude";

test("a região do próprio contato vale (mesmo fora do padrão)", () => {
  assert.equal(regiaoEfetiva("Nordeste", "Prefeitura - Sul"), "Nordeste");
  assert.equal(regiaoEfetiva("  Região Norte ", "X - Sul"), "Região Norte");
});

test("sem região no contato, vale a do nome da planilha (qualquer órgão)", () => {
  assert.equal(regiaoEfetiva(null, "Defensoria Pública Estadual - Norte"), "Norte");
  assert.equal(regiaoEfetiva("", "Órgão Novo Qualquer - Centro-Oeste"), "Centro-Oeste");
  assert.equal(regiaoEfetiva("   ", "Cidade na mão - Região Nordeste"), "Nordeste");
});

test("sem região em lugar nenhum: 'Sem região'", () => {
  assert.equal(regiaoEfetiva(undefined, "Planilha sem padrão no nome"), "Sem região");
  assert.equal(regiaoDoNomeDaBase("Consórcios"), null);
});
