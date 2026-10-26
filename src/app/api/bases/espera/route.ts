import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { ensureEsperaTable, listarEspera, nomeEsperaValido } from "@/lib/espera";
import { headersPlanilhaNova } from "@/lib/base-columns";
import { REGIOES_BRASIL, tipoOrgao } from "@/lib/completude";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const { deny } = await requireUser();
  if (deny) return deny;
  return NextResponse.json({ itens: await listarEspera() });
}

// Adiciona um nome à lista de espera (sem repetir).
export async function POST(req: Request) {
  const { deny, session } = await requireUser();
  if (deny) return deny;
  const body = await req.json().catch(() => ({}));
  const nome = nomeEsperaValido(body?.nome);
  if (!nome) return NextResponse.json({ error: 'Informe um nome (sem " - ").' }, { status: 400 });
  await ensureEsperaTable();
  const ja = await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "BaseEspera" WHERE lower("nome") = lower($1) LIMIT 1`, nome);
  if (ja.length) return NextResponse.json({ error: "Esse nome já está na lista de espera." }, { status: 409 });
  await prisma.$executeRawUnsafe(`INSERT INTO "BaseEspera" ("id","nome","porId") VALUES ($1,$2,$3)`, randomUUID(), nome, (session?.user as { id?: string } | undefined)?.id ?? null);
  return NextResponse.json({ itens: await listarEspera() });
}

// Remove da lista; com { criar: true } cria o órgão (as 5 regiões) e tira da lista.
export async function DELETE(req: Request) {
  const { deny } = await requireUser();
  if (deny) return deny;
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "Item obrigatório" }, { status: 400 });
  await ensureEsperaTable();
  const [item] = await prisma.$queryRawUnsafe<{ nome: string }[]>(`SELECT "nome" FROM "BaseEspera" WHERE "id" = $1`, id);
  if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  let criadas = 0;
  if (body?.criar === true) {
    const bases = await prisma.base.findMany({ select: { name: true } });
    if (bases.some((b) => tipoOrgao(b.name).toLowerCase() === item.nome.toLowerCase())) {
      return NextResponse.json({ error: "Já existe um órgão com esse nome." }, { status: 409 });
    }
    const r = await prisma.base.createMany({
      data: REGIOES_BRASIL.map((reg) => ({ name: `${item.nome} - ${reg}`, source: "manual", headers: headersPlanilhaNova() as Prisma.InputJsonValue })),
    });
    criadas = r.count;
  }
  await prisma.$executeRawUnsafe(`DELETE FROM "BaseEspera" WHERE "id" = $1`, id);
  return NextResponse.json({ ok: true, nome: item.nome, criadas, itens: await listarEspera() });
}
