import { requireUser } from "@/lib/guard";
import { currentRole } from "@/lib/current-role";
import { auth } from "@/auth";
import { buildRankings, type ParamsRanking } from "@/lib/ranking";
import { ranquear } from "@/lib/ranking-calc";
import { filtrarColunas } from "@/lib/export-cols";

export const dynamic = "force-dynamic";

// CSV com ";" (Excel pt-BR) e BOM para os acentos.
function cell(v: string | number) {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const toCsv = (rows: (string | number)[][]) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");

export async function GET(req: Request) {
  const { deny } = await requireUser();
  if (deny) return deny;
  const session = await auth();
  const meId = (session?.user as { id?: string } | undefined)?.id || "";
  const role = await currentRole(session);

  const url = new URL(req.url);
  const sp: ParamsRanking = Object.fromEntries(url.searchParams.entries());
  const d = await buildRankings(sp, { id: meId, admin: role === "admin" });

  const rows: (string | number)[][] = [["Posição", "Pessoa", "Atividades", "Preenchidas", "Corrigidas", "Validadas", "Sim", "Não", "Taxa de acerto"]];
  ranquear(d.linhas, "atividades").forEach((l) =>
    rows.push([l.posicao, l.nome, l.atividades, l.preenchidas, l.corrigidas, l.validadas, l.oculto ? "" : l.sim, l.oculto ? "" : l.nao, l.taxa === null ? "" : `${l.taxa}%`])
  );
  const ini = d.faixa.de.slice(0, 10);
  const fim = new Date(new Date(d.faixa.ate).getTime() - 1).toISOString().slice(0, 10);
  return new Response(toCsv(filtrarColunas(rows, url.searchParams.get("cols"))), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ranking-${ini}_a_${fim}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
