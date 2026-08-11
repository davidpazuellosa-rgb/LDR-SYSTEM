import * as XLSX from "xlsx";
import { parse } from "papaparse";
import { CONTACT_FIELDS, PHONE_FIELD } from "@/lib/contact-fields";
import { ehUfValida, regiaoDaUf, ufSigla } from "@/lib/uf";

// Uma linha importada carrega os campos reconhecidos (`row`) e, separadamente,
// os valores das colunas NÃO reconhecidas (`customValues`, chave = cabeçalho
// original da planilha) — antes esse dado era descartado; agora vira coluna
// personalizada na base (ver /api/bases/[id]/import).
export type ImportedRow = Record<string, string> & { __customValues?: Record<string, string> };
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

// Casa os cabeçalhos da planilha com os campos do sistema. 2 passadas: primeiro
// só match EXATO (cabeçalho bate 100% com uma pista — ex.: "UF" com a pista
// "uf"), depois match por APROXIMAÇÃO (cabeçalho CONTÉM a pista — ex.: "Nome
// do Prefeito Atual" contém "prefeito") pro que sobrou. Isso evita que uma
// coluna ambígua (ex.: "Sigla", que também é pista de "estado") roube o lugar
// de uma coluna inequívoca (ex.: "UF") só por vir depois na planilha.
function buildColMap(headers: string[]): (string | null)[] {
  const colMap: (string | null)[] = new Array(headers.length).fill(null);
  const claimed = new Set<string>();
  const norm = headers.map((h) => h.toLowerCase().trim());
  norm.forEach((h, idx) => {
    if (!h) return;
    for (const field of CONTACT_FIELDS) {
      if (claimed.has(field.key)) continue;
      if (field.hints.includes(h)) {
        colMap[idx] = field.key;
        claimed.add(field.key);
        break;
      }
    }
  });
  norm.forEach((h, idx) => {
    if (!h || colMap[idx]) return;
    for (const field of CONTACT_FIELDS) {
      if (claimed.has(field.key)) continue;
      if (field.hints.some((hint) => h.includes(hint))) {
        colMap[idx] = field.key;
        claimed.add(field.key);
        break;
      }
    }
  });
  return colMap;
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

// `sheetNameUf` = a aba tem um nome que é uma UF válida (ex.: "RS") — usado
// como região/estado de TODA linha da aba que não trouxer isso preenchido.
// Cobre o caso de planilha dividida em várias abas, uma por estado, sem
// coluna própria de UF (o caso oposto: planilha com coluna de UF explícita
// já funciona normalmente, a aba nem precisa ter nome de estado).
function normalizeRows(raw: string[][], sheetNameUf: string | null = null): SpreadsheetParseResult {
  const headers = (raw[0] || []).map((h) => String(h).trim());
  const colMap = buildColMap(headers);
  const matchedColumns = headers
    .map((header, idx) => {
      const field = colMap[idx];
      return field ? { header, field, label: fieldLabel(field) } : null;
    })
    .filter((item): item is SpreadsheetColumnMatch => Boolean(item));
  const unknownColumns = headers.filter((header, idx) => header && !colMap[idx]);
  // "estado" também é satisfeito pelo nome da aba (planilha dividida por UF).
  const missingRequiredColumns = REQUIRED_IMPORT_FIELDS.filter((field) => {
    if (colMap.includes(field)) return false;
    if (field === "estado" && sheetNameUf) return false;
    return true;
  }).map(fieldLabel);

  if (raw.length < 2) {
    return { rows: [], headers, matchedColumns, unknownColumns, missingRequiredColumns };
  }

  const rows: ImportedRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const line = raw[i];
    const row: ImportedRow = {};
    const customValues: Record<string, string> = {};
    let hasData = false;
    colMap.forEach((field, idx) => {
      const value = String(line[idx] ?? "").trim();
      if (!value) return;
      if (field) {
        row[field] = value;
      } else if (headers[idx]) {
        // Coluna não reconhecida: guarda o valor (vira coluna personalizada
        // na base) em vez de simplesmente descartar o dado.
        customValues[headers[idx]] = value;
      }
      hasData = true;
    });
    // Nome da aba como UF: só preenche o que a própria planilha não trouxe.
    if (sheetNameUf && !row.estado) row.estado = sheetNameUf;
    if (sheetNameUf && !row.regiao) {
      const r = regiaoDaUf(sheetNameUf);
      if (r) row.regiao = r;
    }
    if (Object.keys(customValues).length > 0) row.__customValues = customValues;
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
  const parsedSheets = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return null;

    const raw: string[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
      raw: false,
    });

    // Só confia no nome da aba como UF se ele for EXATAMENTE uma sigla válida
    // (ex.: "RS") — nunca um chute (uma aba "RSSC" ou "Prefeituras" não é UF).
    const sheetNameUf = ehUfValida(sheetName) ? ufSigla(sheetName) : null;
    return normalizeRows(raw, sheetNameUf);
  }).filter((result): result is SpreadsheetParseResult => Boolean(result && result.headers.length));

  const usableSheets = parsedSheets.filter((result) => result.missingRequiredColumns.length === 0);
  const sheetsToImport = usableSheets.length > 0 ? usableSheets : parsedSheets;

  if (sheetsToImport.length === 0) {
    return {
      rows: [],
      headers: [],
      matchedColumns: [],
      unknownColumns: [],
      missingRequiredColumns: REQUIRED_IMPORT_FIELDS.map(fieldLabel),
    };
  }

  return {
    rows: sheetsToImport.flatMap((result) => result.rows),
    headers: Array.from(new Set(sheetsToImport.flatMap((result) => result.headers))),
    matchedColumns: Array.from(
      new Map(
        sheetsToImport
          .flatMap((result) => result.matchedColumns)
          .map((column) => [`${column.header}:${column.field}`, column])
      ).values()
    ),
    unknownColumns: Array.from(new Set(sheetsToImport.flatMap((result) => result.unknownColumns))),
    missingRequiredColumns: usableSheets.length > 0
      ? []
      : Array.from(new Set(parsedSheets.flatMap((result) => result.missingRequiredColumns))),
  };
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
