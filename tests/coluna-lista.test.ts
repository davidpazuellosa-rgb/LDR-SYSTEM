import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizarLista, valorValidoNaLista, corDaOpcao, OPCOES_SIM_NAO, MAX_OPCOES } from "../src/lib/coluna-lista";
import { parseCustomCols } from "../src/lib/base-columns";

test("coluna de texto (sem tipo) fica exatamente igual — nada de campo extra", () => {
  assert.deepEqual(sanitizarLista({ key: "c1", label: "Obs" }), {});
  assert.deepEqual(parseCustomCols({ __cols__: [{ key: "c1", label: "Obs" }] }), [{ key: "c1", label: "Obs" }]);
});

test("lista: normaliza opções (trim, sem repetidas/vazias, cor inválida vira cinza)", () => {
  const r = sanitizarLista({
    tipo: "lista",
    opcoes: [{ valor: " Sim ", cor: "verde" }, { valor: "sim", cor: "azul" }, { valor: "", cor: "rosa" }, { valor: "Talvez", cor: "xyz" }, null],
  });
  assert.deepEqual(r.opcoes, [{ valor: "Sim", cor: "verde" }, { valor: "Talvez", cor: "cinza" }]);
});

test("limites: máximo de opções e tamanho do nome", () => {
  const muitas = Array.from({ length: 50 }, (_, i) => ({ valor: `o${i}`, cor: "verde" }));
  assert.equal(sanitizarLista({ tipo: "lista", opcoes: muitas }).opcoes?.length, MAX_OPCOES);
  const longa = sanitizarLista({ tipo: "lista", opcoes: [{ valor: "x".repeat(100), cor: "verde" }] });
  assert.equal(longa.opcoes?.[0].valor.length, 40);
});

test("padrão só vale se for uma das opções", () => {
  assert.equal(sanitizarLista({ tipo: "lista", opcoes: OPCOES_SIM_NAO, padrao: "Não" }).padrao, "Não");
  assert.equal(sanitizarLista({ tipo: "lista", opcoes: OPCOES_SIM_NAO, padrao: "Talvez" }).padrao, undefined);
});

test("validação: vazio sempre pode; fora da lista é recusado", () => {
  assert.equal(valorValidoNaLista(OPCOES_SIM_NAO, ""), true);
  assert.equal(valorValidoNaLista(OPCOES_SIM_NAO, "Sim"), true);
  assert.equal(valorValidoNaLista(OPCOES_SIM_NAO, "sim"), false);
  assert.equal(valorValidoNaLista(OPCOES_SIM_NAO, "Talvez"), false);
  assert.equal(corDaOpcao(OPCOES_SIM_NAO, "Não"), "vermelho");
  assert.equal(corDaOpcao(OPCOES_SIM_NAO, "x"), null);
});

test("parseCustomCols preserva a lista salva", () => {
  const cols = parseCustomCols({ __cols__: [{ key: "c2", label: "Contatado", tipo: "lista", opcoes: OPCOES_SIM_NAO, padrao: "Não" }] });
  assert.equal(cols[0].tipo, "lista");
  assert.equal(cols[0].padrao, "Não");
  assert.equal(cols[0].opcoes?.length, 2);
});
