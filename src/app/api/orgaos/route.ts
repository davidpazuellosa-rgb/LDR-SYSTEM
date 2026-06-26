import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { REGIOES_BRASIL, regiaoCanonica, tipoOrgao } from "@/lib/completude";

// Cria/completa um "órgão": gera uma base vazia por região do Brasil ("{Órgão} - {Região}"),
// pulando as regiões que o órgão já cobre (idempotente). Serve tanto para criar um órgão
// novo quanto para completar as regiões faltantes de um órgão que já existe (backfill).
export async function POST(req: Request) {
  const { deny } = await requireUser();
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const nome = String(body?.nome || "").trim();
  const description = body?.description ? String(body.description) : null;
  if (!nome) return NextResponse.json({ error: "Nome do órgão obrigatório" }, { status: 400 });

  // Regiões que esse órgão já cobre — pelo nome das bases existentes...
  const bases = await prisma.base.findMany({ select: { id: true, name: true } });
  const doTipo = bases.filter((b) => tipoOrgao(b.name) === nome);
  const jaTem = new Set<string>();
  for (const b of doTipo) {
    const r = regiaoCanonica(b.name.split(" - ")[1] || "");
    if (r) jaTem.add(r);
  }
  // ...e pelas regiões que aparecem nos contatos desse órgão.
  if (doTipo.length > 0) {
    const contatos = await prisma.contact.findMany({
      where: { baseId: { in: doTipo.map((b) => b.id) }, deletedAt: null },
      select: { regiao: true },
      distinct: ["regiao"],
    });
    for (const c of contatos) {
      const r = regiaoCanonica(c.regiao);
      if (r) jaTem.add(r);
    }
  }

  const faltam = REGIOES_BRASIL.filter((r) => !jaTem.has(r));
  if (faltam.length > 0) {
    await prisma.base.createMany({
      data: faltam.map((r) => ({ name: `${nome} - ${r}`, description, source: "manual" })),
    });
  }

  return NextResponse.json({ ok: true, orgao: nome, criadas: faltam.length, regioes: faltam });
}
