import test from "node:test";
import assert from "node:assert/strict";
import {
  ligarValidacao, desligarValidacao, protegerColunaValidacao, valorDeValidacao, valorGravado,
  contarValidacao, validacaoAtiva, colunaValidacao, colunasDeCompletude, VALIDAR_KEY,
} from "../src/lib/validacao";
import { parseCustomCols, parseHiddenCols } from "../src/lib/base-columns";
import { isRowVazia } from "../src/lib/completude";

test("valorDeValidacao: Sim/Não (com ou sem acento/caixa); vazio e '–' = ainda não validado", () => {
  assert.equal(valorDeValidacao("Sim"), "sim");
  assert.equal(valorDeValidacao(" sim "), "sim");
  assert.equal(valorDeValidacao("Não"), "nao");
  assert.equal(valorDeValidacao("nao"), "nao");
  assert.equal(valorDeValidacao("–"), null);
  assert.equal(valorDeValidacao(""), null);
  assert.equal(valorDeValidacao(null), null);
  assert.equal(valorGravado("sim"), "Sim");
  assert.equal(valorGravado("nao"), "Não");
  assert.equal(valorGravado(null), null); // o "–" nunca é gravado
});

test("ligarValidacao: cria a coluna do sistema, visível, com Sim/Não/–", () => {
  const r = ligarValidacao({});
  assert.equal(r.criada, true);
  assert.equal(validacaoAtiva(r.headers), true);
  const col = colunaValidacao(r.headers)!;
  assert.equal(col.label, "Validado");
  assert.equal(col.sistema, "validacao");
  assert.deepEqual(col.opcoes?.map((o) => o.valor), ["Sim", "Não", "–"]);
  assert.ok(!parseHiddenCols(r.headers).includes(col.key));
});

test("ligarValidacao: adota a coluna 'Validado' que já existe, mantendo a chave (e os valores)", () => {
  const antes = { __cols__: [{ key: "c_abc", label: "VALIDADO", tipo: "lista", opcoes: [{ valor: "Sim", cor: "verde" }, { valor: "Não", cor: "vermelho" }] }] };
  const r = ligarValidacao(antes);
  assert.equal(r.adotada, true);
  assert.equal(r.criada, false);
  const cols = parseCustomCols(r.headers);
  assert.equal(cols.length, 1);
  assert.equal(cols[0].key, "c_abc");
  assert.equal(cols[0].sistema, "validacao");
  assert.equal(cols[0].opcoes?.length, 3);
});

test("ligarValidacao: mostra de novo a coluna que estava oculta/excluída", () => {
  const off = desligarValidacao(ligarValidacao({}).headers);
  const key = colunaValidacao(off)!.key;
  assert.equal(validacaoAtiva(off), false);
  assert.ok(parseHiddenCols(off).includes(key)); // desligar só oculta
  const on = ligarValidacao({ ...off, __deleted__: [key] }).headers;
  assert.ok(!parseHiddenCols(on).includes(key));
  assert.equal(parseCustomCols(on).length, 1); // não duplicou
});

test("protegerColunaValidacao: com a validação ligada a coluna não some nem muda", () => {
  const h = ligarValidacao({ __cols__: [{ key: "x", label: "Outra" }] }).headers;
  const key = colunaValidacao(h)!.key;
  // tentativa de apagar
  const semEla = protegerColunaValidacao(h, [{ key: "x", label: "Outra" }]);
  assert.ok(semEla.some((c) => c.key === key && c.sistema === "validacao"));
  // tentativa de renomear / mudar opções
  const editada = protegerColunaValidacao(h, [{ key: "x", label: "Outra" }, { key, label: "Hackeada", tipo: "lista", sistema: "validacao", opcoes: [{ valor: "Talvez", cor: "azul" }] }]);
  const c = editada.find((k) => k.key === key)!;
  assert.equal(c.label, "Validado");
  assert.deepEqual(c.opcoes?.map((o) => o.valor), ["Sim", "Não", "–"]);
});

test("protegerColunaValidacao: ninguém marca outra coluna como 'sistema'", () => {
  const r = protegerColunaValidacao({}, [{ key: "y", label: "Y", tipo: "lista", sistema: "validacao", opcoes: [] }]);
  assert.equal(r[0].sistema, undefined);
});

test("a coluna de validação fica fora da regra de linha preenchida", () => {
  const cols = parseCustomCols(ligarValidacao({ __cols__: [{ key: "x", label: "Outra" }] }).headers);
  assert.deepEqual(colunasDeCompletude(cols).map((c) => c.key), ["x"]);
});

test("'–' sozinho não conta como dado da linha", () => {
  assert.equal(isRowVazia({}, { validado: "–" }), true);
  assert.equal(isRowVazia({ cidade: "Manaus" }, { validado: "–" }), false);
});

test("contarValidacao: Sim, Não e a validar", () => {
  assert.deepEqual(contarValidacao(["Sim", "Não", "", null, "–", "sim"]), { sim: 2, nao: 1, aValidar: 3 });
  assert.equal(VALIDAR_KEY, "__validar__");
});
