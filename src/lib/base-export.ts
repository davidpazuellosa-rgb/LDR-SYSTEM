// Montagem do CSV da planilha (separada da rota para poder ser testada).
// As colunas vêm de resolveBaseColumns — nunca de uma lista escrita aqui.

import type { ResolvedCol } from "@/lib/base-columns";
import { STATUS_META } from "@/lib/status";

// Coluna extra que não existe na grade: na tela a situação do telefone é a
// cor/filtro da célula. Vai sempre no fim, depois das colunas de verdade.
export const SITUACAO_LABEL = "Situação";

export type ExportRow = {
  id: string;
  status: string;
} & Record<string, unknown>;

// Escapa um campo CSV. Aspas, quebra de linha, "," e ";" obrigam a citar.
export function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /["\r\n,;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildBaseCsv({
  cols,
  rows,
  customValues = {},
}: {
  cols: ResolvedCol[];
  rows: ExportRow[];
  customValues?: Record<string, Record<string, string>>;
}): string {
  const linhas = [[...cols.map((c) => c.label), SITUACAO_LABEL].map(csvCell).join(";")];
  for (const row of rows) {
    const custom = customValues[row.id] || {};
    const linha = cols.map((col) => csvCell(col.kind === "custom" ? custom[col.key] : row[col.key]));
    linha.push(csvCell(STATUS_META[row.status]?.label || row.status));
    linhas.push(linha.join(";"));
  }
  // BOM para os acentos abrirem certo no Excel.
  return "﻿" + linhas.join("\r\n");
}
