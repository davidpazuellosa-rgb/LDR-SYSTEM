import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import * as XLSX from "xlsx";
import {
  MAX_SPREADSHEET_BYTES,
  looksLikeValidPhone,
  parseSpreadsheet,
  parseSpreadsheetWithMeta,
  validateSpreadsheetFile,
} from "../src/lib/import";

test("parseSpreadsheet normalizes supported CSV headers", () => {
  const csv = [
    "Cidade,UF,Telefone,E-mail,Prefeito",
    "Manaus,AM,(92) 99999-0000,contato@manaus.am.gov.br,Joana Silva",
    "Linha vazia,,,,",
  ].join("\n");

  const rows = parseSpreadsheet(Buffer.from(csv, "utf8"), "contatos.csv");

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    cidade: "Manaus",
    estado: "AM",
    telefonePrefeitura: "(92) 99999-0000",
    emailInstitucional: "contato@manaus.am.gov.br",
    nomePrefeito: "Joana Silva",
  });
});

test("parseSpreadsheet imports rows from every workbook sheet", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Cidade", "UF", "Telefone"],
      ["Maceió", "AL", "(82) 99999-0000"],
    ]),
    "ALAGOAS"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Cidade", "UF", "Telefone"],
      ["Salvador", "BA", "(71) 99999-0000"],
    ]),
    "BAHIA"
  );

  const rows = parseSpreadsheet(Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })), "contatos.xlsx");

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => row.estado),
    ["AL", "BA"]
  );
});

test("looksLikeValidPhone accepts only plausible Brazilian phone lengths", () => {
  assert.equal(looksLikeValidPhone("(92) 99999-0000"), true);
  assert.equal(looksLikeValidPhone("+55 92 99999-0000"), true);
  assert.equal(looksLikeValidPhone("12345"), false);
  assert.equal(looksLikeValidPhone(null), false);
});

test("validateSpreadsheetFile rejects unsafe or oversized uploads", () => {
  assert.equal(
    validateSpreadsheetFile({ name: "contatos.exe", size: 100, type: "application/octet-stream" }),
    "Formato inválido. Envie CSV, XLS ou XLSX."
  );
  assert.equal(
    validateSpreadsheetFile({ name: "contatos.csv", size: MAX_SPREADSHEET_BYTES + 1, type: "text/csv" }),
    "Arquivo maior que 20 MB."
  );
  assert.equal(validateSpreadsheetFile({ name: "contatos.csv", size: 100, type: "text/csv" }), null);
});

test("parseSpreadsheetWithMeta reports required and unknown columns", () => {
  const csv = [
    "Cidade,UF,Coluna Estranha",
    "Manaus,AM,valor",
  ].join("\n");

  const result = parseSpreadsheetWithMeta(Buffer.from(csv, "utf8"), "contatos.csv");

  assert.deepEqual(result.missingRequiredColumns, ["Telefone geral da prefeitura"]);
  assert.deepEqual(result.unknownColumns, ["Coluna Estranha"]);
  assert.deepEqual(
    result.matchedColumns.map((column) => column.field),
    ["cidade", "estado"]
  );
});
