import test from "node:test";
import assert from "node:assert/strict";
import { matrizParaTSV, tsvParaMatriz } from "../src/lib/tsv";

test("copiar e colar de volta devolve exatamente as mesmas células (inclusive com quebra de linha)", () => {
  const m = [
    ["Limoeiro", "(81) 9.9661-0320\n(81) 9.7340-2503", "x"],
    ["Aliança", 'disse "olá"', "a\tb"],
  ];
  assert.deepEqual(tsvParaMatriz(matrizParaTSV(m)), m);
});

test("célula com duas linhas NÃO vira duas linhas da planilha", () => {
  const tsv = matrizParaTSV([["(81) 1\n(81) 2"]]);
  assert.equal(tsv, '"(81) 1\n(81) 2"');
  assert.equal(tsvParaMatriz(tsv).length, 1);
});

test("texto simples e do Excel continuam iguais (último \\n e \\r\\n)", () => {
  assert.deepEqual(tsvParaMatriz("a\tb\nc\td\n"), [["a", "b"], ["c", "d"]]);
  assert.deepEqual(tsvParaMatriz("a\tb\r\nc\td\r\n"), [["a", "b"], ["c", "d"]]);
  assert.deepEqual(tsvParaMatriz("só um valor"), [["só um valor"]]);
});

test("célula vazia no fim e linhas em branco do meio são mantidas", () => {
  assert.deepEqual(tsvParaMatriz("a\t\nb\tc"), [["a", ""], ["b", "c"]]);
  assert.deepEqual(tsvParaMatriz("a\n\nb"), [["a"], [""], ["b"]]);
});

test("aspas que não fecham: cai no jeito simples (sem engolir o resto)", () => {
  assert.deepEqual(tsvParaMatriz('"abc\ndef'), [['"abc'], ["def"]]);
});

test("aspas no meio do texto não têm efeito", () => {
  assert.deepEqual(tsvParaMatriz('ele disse "oi"\tok'), [['ele disse "oi"', "ok"]]);
});
