import * as XLSX from "xlsx";
import { parse } from "papaparse";
import { CONTACT_FIELDS, PHONE_FIELD } from "@/lib/contact-fields";

export type ImportedRow = Record<string, string>;
export type SpreadsheetColumnMatch = {
  header: string;
  field: string;
  label: string;
};
export type SpreadsheetParseResult = {
  rows: ImportedRow[];
  headers: string[];
  matchedColumns: SpreadsheetColumnMatch[];
  unknownColumns: string[];
  missingRequiredColumns: string[];
};

export const MAX_SPREADSHEET_BYTES = 20 * 1024 * 1024;
export const REQUIRED_IMPORT_FIELDS = ["cidade", "estado", PHONE_FIELD];

const ALLOWED_EXTENSIONS = new Set(["csv", "xls", "xlsx"]);
const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

type SpreadsheetFileLike = Pick<File, "name" | "size" | "type">;
const FIELD_LABELS = new Map(CONTACT_FIELDS.map((field) => [field.key, field.label]));

function matchField(header: string): string | null {
  const h = header.toLowerCase().trim();
  for (const field of CONTACT_FIELDS) {
    if (field.hints.some((hint) => h.includes(hint))) return field.key;
  }
  return null;
}

function fieldLabel(key: string) {
  return FIELD_LABELS.get(key) || key;
}

export function validateSpreadsheetFile(file: SpreadsheetFileLike): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";

  if (file.size <= 0) return "Arquivo vazio.";
  if (file.size > MAX_SPREADSHEET_BYTES) return "Arquivo maior que 20 MB.";
  if (!ALLOWED_EXTENSIONS.has(extension)) return "Formato inválido. Envie CSV, XLS ou XLSX.";
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) return "Tipo de arquivo inválido.";

  return null;
}

function normalizeRows(raw: string[][]): SpreadsheetParseResult {
  const headers = (raw[0] || []).map((h) => String(h).trim());
  const colMap = headers.map(matchField);
  const matchedColumns = headers
    .map((header, idx) => {
      const field = colMap[idx];
      return field ? { header, field, label: fieldLabel(field) } : null;
    })
    .filter((item): item is SpreadsheetColumnMatch => Boolean(item));
  const unknownColumns = headers.filter((header, idx) => header && !colMap[idx]);
  const missingRequiredColumns = REQUIRED_IMPORT_FIELDS.filter((field) => !colMap.includes(field)).map(fieldLabel);

  if (raw.length < 2) {
    return { rows: [], headers, matchedColumns, unknownColumns, missingRequiredColumns };
  }


  const rows: ImportedRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const line = raw[i];
    const row: ImportedRow = {};
    let hasData = false;
    colMap.forEach((field, idx) => {
      if (!field) return;
      const value = String(line[idx] ?? "").trim();
      if (value) {
        row[field] = value;
        hasData = true;
      }
    });
    if (hasData) rows.push(row);
  }
  return { rows, headers, matchedColumns, unknownColumns, missingRequiredColumns };
}

function parseCsv(buffer: Buffer): SpreadsheetParseResult {
  const result = parse<string[]>(buffer.toString("utf8"), {
    skipEmptyLines: true,
  });

  return normalizeRows(result.data);
}

function parseWorkbook(buffer: Buffer): SpreadsheetParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellFormula: false, cellHTML: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { rows: [], headers: [], matchedColumns: [], unknownColumns: [], missingRequiredColumns: REQUIRED_IMPORT_FIELDS.map(fieldLabel) };

  const raw: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });

  return normalizeRows(raw);
}

// Recebe o conteúdo de um arquivo CSV ou Excel e devolve linhas normalizadas.
export function parseSpreadsheet(buffer: Buffer, filename = ""): ImportedRow[] {
  return parseSpreadsheetWithMeta(buffer, filename).rows;
}

export function parseSpreadsheetWithMeta(buffer: Buffer, filename = ""): SpreadsheetParseResult {
  const extension = filename.split(".").pop()?.toLowerCase();

  if (extension === "csv") return parseCsv(buffer);
  return parseWorkbook(buffer);
}

// Heurística simples: telefone "válido" tem ao menos 10 dígitos (DDD + número).
export function looksLikeValidPhone(phone?: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}
