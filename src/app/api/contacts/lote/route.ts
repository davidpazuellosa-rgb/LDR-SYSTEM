import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";

const LIMITE_LINHAS_POR_VEZ = 5000;

// Adiciona N linhas em branco no fim de uma base (ou de uma página/UF), de uma vez.
// Só baseId é obrigatório no banco; estado/regiao são o andaime da página.
export async function POST(req: Request) {
  const { session, deny } = await requireUser();
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const baseId = String(body?.baseId || "");
  const quantidade = Math.trunc(Number(body?.quantidade));
  if (!baseId) return NextResponse.json({ error: "baseId obrigatório" }, { status: 400 });
  if (!Number.isFinite(quantidade) || quantidade < 1 || quantidade > LIMITE_LINHAS_POR_VEZ) {
    return NextResponse.json({ error: `Informe de 1 a ${LIMITE_LINHAS_POR_VEZ} linhas.` }, { status: 400 });
  }

  // Sem região informada (planilha aberta fora de um card de região), herda a das linhas
  // que a página/UF já tem — senão as novas linhas somem quando a base é aberta pelo card.
  const estado = body?.estado ? String(body.estado) : null;
  let regiao = body?.regiao ? String(body.regiao) : null;
  if (!regiao && estado) {
    const ref = await prisma.contact.findFirst({
      where: { baseId, estado, deletedAt: null, regiao: { not: null } },
      select: { regiao: true },
    });
    regiao = ref?.regiao ?? null;
  }

  const data = {
    baseId,
    // @ts-expect-error id custom na sessão
    createdById: session.user.id ?? null,
    estado,
    regiao,
  };

  const criadas = [];
  for (let feito = 0; feito < quantidade; feito += 1000) {
    const n = Math.min(1000, quantidade - feito);
    criadas.push(...(await prisma.contact.createManyAndReturn({ data: Array.from({ length: n }, () => data) })));
  }
  return NextResponse.json({ criadas });
}
