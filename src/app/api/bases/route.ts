import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { headersPlanilhaNova } from "@/lib/base-columns";
import { regiaoCanonica } from "@/lib/completude";
import type { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  const { deny } = await requireUser();
  if (deny) return deny;

  const body = await req.json();
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  // Planilha de região ("{Órgão} - {Região}") já existente: devolve a que existe em vez de
  // criar um duplicado (foi assim que duas "Defensoria Pública - Norte" apareceram, cada
  // pessoa vendo uma planilha diferente).
  const parte = name.split(" - ")[1];
  if (parte && regiaoCanonica(parte)) {
    const existente = await prisma.base.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
    });
    if (existente) return NextResponse.json(existente);
  }

  const base = await prisma.base.create({
    data: {
      name,
      description: body?.description ? String(body.description) : null,
      source: "manual",
      // Planilha nova nasce SEM colunas: só aparecem ao importar ou criar à mão.
      headers: headersPlanilhaNova() as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json(base);
}
