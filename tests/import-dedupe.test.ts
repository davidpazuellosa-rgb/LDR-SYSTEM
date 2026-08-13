import { test } from "node:test";
import assert from "node:assert/strict";
import { dedupeKey, dedupeKeyDaLinha } from "../src/lib/import-dedupe";

const linha = (data: Record<string, string>, custom: Record<string, string> = {}) => ({ data, custom });

test("chave de negócio continua valendo quando a planilha tem as colunas clássicas", () => {
  assert.equal(dedupeKey({ codigoIbge: "410010" }), "ibge:410010");
  assert.equal(dedupeKey({ cidade: "Curitiba", estado: "PR" }), "cidade:pr:curitiba");
  // Mesma cidade/UF com e-mails diferentes são contatos diferentes (consórcios).
  assert.notEqual(
    dedupeKey({ cidade: "Florianópolis", estado: "SC", emailInstitucional: "a@x.br" }),
    dedupeKey({ cidade: "Florianópolis", estado: "SC", emailInstitucional: "b@x.br" })
  );
});

test("planilha livre não perde linhas: cai no conteúdo em vez de ficar sem chave", () => {
  // Antes: dedupeKey -> null -> a linha era descartada em silêncio.
  const row = linha({}, { c_produto: "Cadeira", c_qtd: "10" });
  assert.equal(dedupeKey(row.data), null);
  const key = dedupeKeyDaLinha(row);
  assert.ok(key && key.startsWith("linha:"));
});

test("linhas livres diferentes têm chaves diferentes; idênticas, iguais", () => {
  const a = dedupeKeyDaLinha(linha({}, { c_produto: "Cadeira" }));
  const b = dedupeKeyDaLinha(linha({}, { c_produto: "Mesa" }));
  const a2 = dedupeKeyDaLinha(linha({}, { c_produto: "  CADEIRA " }));
  assert.notEqual(a, b);
  assert.equal(a, a2); // normaliza espaço/acento/caixa
});

test("a ordem das colunas não muda a identidade da linha", () => {
  const a = dedupeKeyDaLinha(linha({}, { c_a: "1", c_b: "2" }));
  const b = dedupeKeyDaLinha(linha({}, { c_b: "2", c_a: "1" }));
  assert.equal(a, b);
});

test("linha totalmente vazia continua sem chave (nada a importar)", () => {
  assert.equal(dedupeKeyDaLinha(linha({}, {})), null);
  assert.equal(dedupeKeyDaLinha(linha({ cidade: "   " }, { c_x: "" })), null);
});
