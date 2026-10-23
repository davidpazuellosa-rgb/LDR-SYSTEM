import test from "node:test";
import assert from "node:assert/strict";
import { chavesExigidas, estadoDaLinha, corDaCelula, proximaCelulaQueFalta, COR_COMPLETA, COR_FALTA } from "../src/lib/linha-cores";

const exigidas = ["cidade", "estado", "telefonePrefeitura", "emailInstitucional", "nomePrefeito", "whatsapp", "siteOficial"];
const linha = (preenchidos: string[]) => (k: string) => (preenchidos.includes(k) ? "x" : "");

test("linha completa → verde em todas as células", () => {
  const e = estadoDaLinha(exigidas, linha(exigidas), false);
  assert.equal(e.tipo, "completa");
  for (const k of [...exigidas, "populacao", "qualquer"]) assert.equal(corDaCelula(e, k), COR_COMPLETA);
});

test("faltam 1 ou 2 → só as vazias que faltam ficam amarelas", () => {
  const um = estadoDaLinha(exigidas, linha(exigidas.filter((k) => k !== "siteOficial")), false);
  assert.equal(um.tipo, "quase");
  assert.equal(corDaCelula(um, "siteOficial"), COR_FALTA);
  assert.equal(corDaCelula(um, "cidade"), null);
  const dois = estadoDaLinha(exigidas, linha(exigidas.filter((k) => k !== "siteOficial" && k !== "whatsapp")), false);
  assert.equal(dois.tipo, "quase");
  assert.deepEqual(dois.faltam, ["whatsapp", "siteOficial"]);
  assert.equal(corDaCelula(dois, "whatsapp"), COR_FALTA);
  assert.equal(corDaCelula(dois, "estado"), null);
});

test("faltam 3 ou mais → sem cor; linha vazia → sem cor", () => {
  const tres = estadoDaLinha(exigidas, linha(["cidade", "estado", "whatsapp", "siteOficial"]), false);
  assert.equal(tres.tipo, "normal");
  assert.equal(corDaCelula(tres, "emailInstitucional"), null);
  const vazia = estadoDaLinha(exigidas, linha([]), true);
  assert.equal(vazia.tipo, "vazia");
  assert.equal(corDaCelula(vazia, "cidade"), null);
});

test("preencher a célula amarela leva a linha ao verde (e apagar volta ao amarelo)", () => {
  const faltando = exigidas.filter((k) => k !== "siteOficial");
  assert.equal(estadoDaLinha(exigidas, linha(faltando), false).tipo, "quase");
  assert.equal(estadoDaLinha(exigidas, linha(exigidas), false).tipo, "completa");
  assert.equal(estadoDaLinha(exigidas, linha(faltando), false).tipo, "quase");
});

test("colunas ocultas não são exigidas; a coluna Validado nunca é", () => {
  const ex = chavesExigidas(new Set(["whatsapp", "siteOficial"]), [
    { key: "c_obs", label: "x" } as { key: string; sistema?: string },
    { key: "c_oculta" },
    { key: "validado", sistema: "validacao" },
  ].filter((c) => c.key !== "c_oculta" || true));
  assert.ok(!ex.includes("whatsapp") && !ex.includes("siteOficial"));
  assert.ok(ex.includes("c_obs"));
  assert.ok(!ex.includes("validado"));
  const ex2 = chavesExigidas(new Set(["c_oculta"]), [{ key: "c_oculta" }, { key: "c_obs" }]);
  assert.ok(!ex2.includes("c_oculta") && ex2.includes("c_obs"));
  // planilha com só 3 colunas exigidas: completa com as 3
  const so3 = chavesExigidas(new Set(["estado", "telefonePrefeitura", "emailInstitucional", "nomePrefeito"]), []);
  assert.deepEqual(so3, ["cidade", "whatsapp", "siteOficial"]);
  assert.equal(estadoDaLinha(so3, linha(so3), false).tipo, "completa");
});

test("próxima célula que falta: avança na ordem da tela e dá a volta; ignora linhas completas e vazias", () => {
  const E = (tipo: "vazia" | "normal" | "quase" | "completa", faltam: string[]) => ({ estado: { tipo, faltam } });
  const linhas = [E("completa", []), E("quase", ["siteOficial"]), E("vazia", []), E("normal", ["whatsapp", "cidade", "siteOficial"])];
  const col = (k: string) => ({ cidade: 0, whatsapp: 5, siteOficial: 6 } as Record<string, number>)[k];
  assert.deepEqual(proximaCelulaQueFalta(linhas, col, null), { row: 1, col: 6 });
  assert.deepEqual(proximaCelulaQueFalta(linhas, col, { row: 1, col: 6 }), { row: 3, col: 0 });
  assert.deepEqual(proximaCelulaQueFalta(linhas, col, { row: 3, col: 0 }), { row: 3, col: 5 });
  assert.deepEqual(proximaCelulaQueFalta(linhas, col, { row: 3, col: 6 }), { row: 1, col: 6 }); // volta ao início
  assert.equal(proximaCelulaQueFalta([E("completa", []), E("vazia", [])], col, null), null);
});
