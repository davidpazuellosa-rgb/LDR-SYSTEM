import { requireAdmin } from "@/lib/guard";
import { buildProducao, type ParamsProducao } from "@/lib/producao";
import { filtrarColunas } from "@/lib/export-cols";

export const dynamic = "force-dynamic";

// CSV com ";" (Excel pt-BR) e BOM para os acentos.
function cell(v: string | number) {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const toCsv = (rows: (string | number)[][]) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
const STATUS: Record<string, string> = { ok: "No ritmo", risco: "Em risco", atrasado: "Atrasado" };

export async function GET(req: Request) {
  const { deny } = await requireAdmin();
  if (deny) return deny;

  const url = new URL(req.url);
  const sp: ParamsProducao = Object.fromEntries(url.searchParams.entries());
  const detalhe = url.searchParams.get("tipo") === "detalhe";
  const d = await buildProducao(sp, { grupos: detalhe });

  let rows: (string | number)[][];
  if (detalhe) {
    rows = [["Pessoa", "Dia", "Tipo", "Orgao", "Regiao", "Estado", "Campanha", "Quantidade"]];
    for (const g of d.grupos) rows.push([g.pessoa, g.dia, g.tipo === "correcao" ? "Correcao" : g.tipo === "validacao" ? "Validacao" : "Preenchimento", g.orgao, g.regiao, g.estado, g.campanha, g.qtd]);
  } else {
    rows = [["Pessoa", "Meta no periodo", "Feito (meta)", "% da meta", "Preenchidas", "Corrigidas", "Validadas", "Total produzido", "Situacao"]];
    for (const l of d.linhas) {
      rows.push([l.nome, l.temMeta ? l.meta : "", l.temMeta ? l.feitoMeta : "", l.temMeta ? `${l.p}%` : "", l.producao.preenchimento, l.producao.correcao, l.producao.validacao, l.producao.total, l.status ? STATUS[l.status] : "Sem meta"]);
    }
    const meta = d.linhas.reduce((a, l) => a + l.meta, 0);
    const feito = d.linhas.reduce((a, l) => a + l.feitoMeta, 0);
    rows.push(["TOTAL DA EQUIPE", meta, feito, meta > 0 ? `${Math.round((feito / meta) * 100)}%` : "", d.kpis.total.preenchimento, d.kpis.total.correcao, d.kpis.total.validacao, d.kpis.total.total, ""]);
  }

  const ini = d.faixa.de.slice(0, 10);
  const fim = new Date(new Date(d.faixa.ate).getTime() - 1).toISOString().slice(0, 10);
  return new Response(toCsv(filtrarColunas(rows, url.searchParams.get("cols"))), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="producao-${detalhe ? "detalhe" : "pessoas"}-${ini}_a_${fim}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
