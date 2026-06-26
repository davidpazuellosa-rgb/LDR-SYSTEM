import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { isAdmin } from "@/lib/permissions";
import { ensureBaseEventoTable } from "@/lib/base-eventos";

export const dynamic = "force-dynamic";

type CampoChange = { campo: string; de: string | null; para: string | null };
type Detalhes = { cidade?: string | null; estado?: string | null; campos?: CampoChange[] };

// Histórico de EDIÇÕES DE CÉLULA da planilha (rodízio das últimas 7, reversíveis).
// Privacidade: o nome de quem alterou só aparece para admin.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, deny } = await requireUser();
  if (deny) return deny;

  const { id } = await params;
  const admin = isAdmin((session.user as { role?: string }).role);

  await ensureBaseEventoTable();
  const eventos = await prisma.baseEvento.findMany({
    where: { baseId: id, tipo: "cell_edit", desfeitoEm: null },
    orderBy: { criadoEm: "desc" },
    take: 7,
  });

  const itens = eventos.map((e) => {
    const d = (e.detalhes as Detalhes | null) || {};
    const campos = d.campos || [];
    const unico = campos.length === 1 ? campos[0] : null;
    return {
      eventoId: e.id,
      cidade: d.cidade ?? null,
      estado: d.estado ?? null,
      campo: unico ? unico.campo : `${campos.length} campos`,
      de: unico ? unico.de : null,
      para: unico ? unico.para : null,
      em: e.criadoEm,
      por: admin ? e.usuarioNome : null,
    };
  });

  return NextResponse.json({ itens });
}
