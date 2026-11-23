import test from "node:test";
import assert from "node:assert/strict";
import { soTracos, valorConta, ehNaoPossui, suspeitasEscrita, classeEspecial, NAO_POSSUI } from "../src/lib/valor-conta";
import { isComplete, isCompleteVisivel, customsCompletos } from "../src/lib/completude";

test("soTracos: qualquer mistura de traços, com ou sem espaço", () => {
  for (const v of ["-", "--", "---", "- - - -", " - ", "—", "–", "— —", "‑", "−−", "- -"]) assert.equal(soTracos(v), true, JSON.stringify(v));
  for (const v of ["", "  ", "a-b", "-1", "Rua - Centro", "n/a", ".", "0", NAO_POSSUI]) assert.equal(soTracos(v), false, JSON.stringify(v));
});

test("valorConta: vazio e só traços não contam; texto e 'Não possui' contam", () => {
  assert.equal(valorConta(null), false);
  assert.equal(valorConta("   "), false);
  assert.equal(valorConta("- - - -"), false);
  assert.equal(valorConta("(82) 3333-4444"), true);
  assert.equal(valorConta("Não possui"), true);
});

test("ehNaoPossui aceita caixa, acento e ponto final", () => {
  for (const v of ["Não possui", "NAO POSSUI", "não possui.", " nao possui "]) assert.equal(ehNaoPossui(v), true, v);
  assert.equal(ehNaoPossui("possui"), false);
});

test("regua de conclusão: hífen em campo da régua e em coluna personalizada NÃO completa", () => {
  const ok = { cidade: "Maragogi", estado: "AL", telefonePrefeitura: "8233", emailInstitucional: "a@b.gov.br", nomePrefeito: "Fulano", whatsapp: "8299", siteOficial: "https://x.gov.br" };
  assert.equal(isComplete(ok), true);
  assert.equal(isComplete({ ...ok, whatsapp: "-" }), false);
  assert.equal(isComplete({ ...ok, whatsapp: "Não possui" }), true);
  assert.equal(customsCompletos(["a", "b"], { a: "x", b: "---" }), false);
  assert.equal(customsCompletos(["a", "b"], { a: "x", b: "Não possui" }), true);
});

test("classeEspecial", () => {
  assert.equal(classeEspecial("--"), "traco");
  assert.equal(classeEspecial("Não possui"), "naopossui");
  assert.equal(classeEspecial("Prefeitura"), null);
  assert.equal(classeEspecial(""), null);
});

test("suspeitasEscrita: texto correto não é marcado", () => {
  for (const v of ["Secretaria Municipal de Obras", "SEINFRA", "SMOSU", "Maragogi", "7h às 17h.", "(82) 3333-4444", "https://www.maragogi.al.gov.br/secretaria", "a@b.gov.br", "Não possui", "AL", "Saúde", "José da Silva", "- - -", ""]) {
    assert.deepEqual(suspeitasEscrita(v), [], v);
  }
});

test("suspeitasEscrita: encontra cada tipo de problema", () => {
  assert.ok(suspeitasEscrita("SECRETARIA MUNICIPAL DE OBRAS").includes("caixa"));
  assert.ok(suspeitasEscrita("secretaria municipal de obras").includes("caixa"));
  assert.ok(suspeitasEscrita("Secretaria  de Obras").includes("espaco"));
  assert.ok(suspeitasEscrita(" Secretaria de Obras").includes("espaco"));
  assert.ok(suspeitasEscrita("Secretaria de Obras ,").includes("espaco"));
  assert.ok(suspeitasEscrita("Secretaria de Saude").includes("acento"));
  assert.ok(suspeitasEscrita("Sao Miguel dos Campos").includes("acento"));
  for (const v of ["VGFVGF", "HBBRHBF", "GVFRG", "FHRBHF", "aaaaaa", "qwrtpsd"]) assert.ok(suspeitasEscrita(v).includes("semsentido"), v);
});

test("tracosContam (reprocessamento): hífen conta só na regra antiga, usada para proteger créditos", () => {
  const ok = { cidade: "A", estado: "AL", telefonePrefeitura: "1", emailInstitucional: "a@b", nomePrefeito: "-", whatsapp: "1", siteOficial: "x" };
  assert.equal(isCompleteVisivel(ok, []), false);
  assert.equal(isCompleteVisivel(ok, [], true), true);
  assert.equal(customsCompletos(["a"], { a: "--" }), false);
  assert.equal(customsCompletos(["a"], { a: "--" }, true), true);
  assert.equal(customsCompletos(["a"], { a: "  " }, true), false);
});
