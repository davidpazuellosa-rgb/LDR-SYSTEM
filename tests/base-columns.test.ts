import test from "node:test";
import assert from "node:assert/strict";
import { CONTACT_FIELDS } from "../src/lib/contact-fields";
import { orderColumns, resolveBaseColumns, completeOrder } from "../src/lib/base-columns";
import { buildBaseCsv, SITUACAO_LABEL } from "../src/lib/base-export";

// Headers de uma base com 3 colunas personalizadas, uma renomeada, uma oculta
// e uma ordem própria — o cenário que fazia o CSV sair diferente da tela.
const headers = {
  cidade: "Município",
  __cols__: [
    { key: "c_ouvidoria", label: "Ouvidoria" },
    { key: "c_chefe", label: "Chefe de Gab. Pref." },
    { key: "c_prospect2", label: "Prospectante 2" },
  ],
  __order__: ["cidade", "siteOficial", "c_ouvidoria", "estado"],
  __hidden__: ["departamentos"],
  __merges__: [{ anchorId: "x" }],
  __sortBy__: { key: "cidade", dir: "asc" },
};

test("resolveBaseColumns inclui as colunas personalizadas", () => {
  const keys = resolveBaseColumns(headers).map((c) => c.key);
  for (const k of ["c_ouvidoria", "c_chefe", "c_prospect2"]) {
    assert.ok(keys.includes(k), `coluna personalizada ${k} ficou de fora`);
  }
});

test("resolveBaseColumns aplica rótulo renomeado, ordem e ocultas", () => {
  const cols = resolveBaseColumns(headers);
  const keys = cols.map((c) => c.key);

  assert.deepEqual(keys.slice(0, 4), ["cidade", "siteOficial", "c_ouvidoria", "estado"]);
  assert.equal(cols.find((c) => c.key === "cidade")?.label, "Município");
  assert.ok(!keys.includes("departamentos"), "coluna oculta não pode aparecer");
  // Chaves reservadas de estrutura nunca viram coluna.
  for (const k of keys) assert.ok(!k.startsWith("__"), `chave reservada virou coluna: ${k}`);
});

test("sem configuração nenhuma, a ordem é a natural dos campos fixos", () => {
  const cols = resolveBaseColumns(null);
  assert.deepEqual(
    cols.map((c) => c.key),
    CONTACT_FIELDS.map((f) => f.key)
  );
});

test("completeOrder guarda a posição das colunas que saíram da visão", () => {
  const full = completeOrder(["b", "a"], ["a", "b", "c"]);
  assert.deepEqual(full, ["b", "a", "c"]);
});

// A trava: o cabeçalho do CSV é sempre o das colunas resolvidas + "Situação".
// Se alguém voltar a escrever uma lista de colunas na exportação, isto quebra.
test("o cabeçalho do CSV é exatamente o das colunas da planilha", () => {
  const cols = resolveBaseColumns(headers);
  const csv = buildBaseCsv({ cols, rows: [] });
  const cabecalho = csv.replace(/^﻿/, "").split("\r\n")[0].split(";");

  assert.deepEqual(cabecalho, [...cols.map((c) => c.label), SITUACAO_LABEL]);
});

test("o CSV traz o valor das colunas personalizadas e escapa o separador", () => {
  const cols = orderColumns({
    cols: [{ key: "c_ouvidoria", label: "Ouvidoria" }],
    order: ["cidade", "c_ouvidoria"],
    hidden: CONTACT_FIELDS.filter((f) => f.key !== "cidade").map((f) => f.key),
  });
  const csv = buildBaseCsv({
    cols,
    rows: [{ id: "r1", status: "telefone_atualizado", cidade: "Abatia" }],
    customValues: { r1: { c_ouvidoria: "(43) 99607-9015; ramal 2" } },
  });
  const linhas = csv.replace(/^﻿/, "").split("\r\n");

  assert.deepEqual(linhas[0].split(";"), ["Cidade", "Ouvidoria", SITUACAO_LABEL]);
  assert.equal(linhas[1], 'Abatia;"(43) 99607-9015; ramal 2";Telefone Atualizado');
});
