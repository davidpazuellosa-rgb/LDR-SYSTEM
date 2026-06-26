import { requireAdmin } from "@/lib/guard";
import { buildRelatorio, parsePeriodo } from "@/lib/relatorio";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { ok: "No ritmo", risco: "Em risco", atrasado: "Atrasado" };

// Escapa um campo CSV e usa ";" como separador (amigável ao Excel pt-BR).
function cell(v: string | number) {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: (string | number)[][]) {
  // BOM para acentos abrirem certo no Excel.
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}

export async function GET(req: Request) {
  const { deny } = await requireAdmin();
  if (deny) return deny;

  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo") === "metas" ? "metas" : "producao";
  const periodo = parsePeriodo(url.searchParams.get("periodo"));
  const r = await buildRelatorio({
    periodo,
    ldrId: url.searchParams.get("ldr"),
    campanha: url.searchParams.get("campanha"),
  });

  let rows: (string | number)[][];
  if (tipo === "metas") {
    rows = [["LDR", "Meta", "Tipo", "Alvo", "Feito", "Percentual", "Situacao"]];
    for (const m of r.metasView) {
      rows.push([m.nome, m.rotulo, m.tipo, m.alvo, m.feito, `${m.p}%`, STATUS_LABEL[m.status] || m.status]);
    }
  } else {
    rows = [["Posicao", "LDR", "Preenchidas", "Corrigidas", "Total"]];
    r.ranking.forEach((row, i) => rows.push([i + 1, row.nome, row.preenchidas, row.corrigidas, row.total]));
  }

  const data = new Date().toISOString().slice(0, 10);
  const filename = `relatorio-${tipo}-${periodo}-${data}.csv`;
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
