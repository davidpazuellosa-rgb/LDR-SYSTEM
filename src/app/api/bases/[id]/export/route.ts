import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { resolveBaseColumns } from "@/lib/base-columns";
import { ensureContactCustomTable } from "@/lib/custom-columns";
import { ensureContactOrdemColuna } from "@/lib/contact-ordem";
import { buildBaseCsv, type ExportRow } from "@/lib/base-export";

export const dynamic = "force-dynamic";

// Exporta os contatos da base em CSV. Somente quem tem permissão (admin).
//
// O CSV é o espelho da planilha: as colunas saem de resolveBaseColumns (a MESMA
// função que a grade usa), então colunas personalizadas, rótulos renomeados,
// ordem e ocultas vêm exatamente como o usuário vê. Coluna nova criada na tela
// entra no CSV sozinha — não existe mais lista de colunas duplicada aqui.
//
// Query opcional (o botão da planilha manda a visão ativa):
//   ?uf=PR        -> só a aba daquela UF (__no_uf__ = linhas sem estado)
//   ?regiao=Norte -> só aquela região (quando a tela foi aberta por um card)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { deny } = await requirePermission("data.export");
  if (deny) return deny;

  const { id } = await params;
  const url = new URL(req.url);
  const uf = (url.searchParams.get("uf") || "").trim();
  const regiao = (url.searchParams.get("regiao") || "").trim();

  // Mesma ordem de linhas da planilha: o "Classificar A→Z/Z→A" compartilhado
  // (Contact.ordem); quem nunca foi ordenado cai no fim, por data de criação.
  await ensureContactOrdemColuna();
  const base = await prisma.base.findUnique({
    where: { id },
    include: {
      contacts: {
        where: { deletedAt: null },
        orderBy: [{ ordem: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      },
    },
  });
  if (!base) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });

  // Filtros da visão ativa (mesma regra da grade e da página).
  const ufDe = (v: string | null) => (v || "").trim().toUpperCase() || "__no_uf__";
  const regiaoDe = (v: string | null) => (v && v.trim()) || "Sem região";
  let rows = base.contacts;
  if (regiao) rows = rows.filter((c) => regiaoDe(c.regiao) === regiao);
  if (uf) rows = rows.filter((c) => ufDe(c.estado) === uf.toUpperCase() || ufDe(c.estado) === uf);

  const headersJson = base.headers as Record<string, unknown> | null;
  const cols = resolveBaseColumns(headersJson);

  // Valores das colunas personalizadas (tabela própria, fora de Contact).
  await ensureContactCustomTable();
  const customValues = new Map<string, Record<string, string>>();
  if (cols.some((c) => c.kind === "custom") && rows.length) {
    const vals = await prisma.contactCustomValue.findMany({
      where: { contactId: { in: rows.map((c) => c.id) } },
      select: { contactId: true, colKey: true, valor: true },
    });
    for (const v of vals) {
      const atual = customValues.get(v.contactId) || {};
      atual[v.colKey] = v.valor ?? "";
      customValues.set(v.contactId, atual);
    }
  }

  const csv = buildBaseCsv({
    cols,
    rows: rows as unknown as ExportRow[],
    customValues: Object.fromEntries(customValues),
  });

  const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  const sufixo = [regiao && slug(regiao), uf && slug(uf)].filter(Boolean).join("_");
  const filename = slug(base.name) + (sufixo ? `_${sufixo}` : "") + ".csv";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
