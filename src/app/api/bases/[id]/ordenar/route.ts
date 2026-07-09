import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { ensureContactOrdemColuna } from "@/lib/contact-ordem";
import { parseCustomCols } from "@/lib/custom-columns";
import { CONTACT_FIELD_KEYS } from "@/lib/contact-fields";

export const dynamic = "force-dynamic";

// Ordenação COMPARTILHADA da planilha (Classificar A→Z/Z→A no cabeçalho da coluna).
// Qualquer usuário logado que acesse a base pode ordenar (LDR também, não só admin) —
// é o mesmo padrão de acesso do /merges. Grava a posição em Contact.ordem (coluna
// adicionada sob demanda) e guarda qual coluna/direção está ativa em
// Base.headers.__sortBy__, para o cabeçalho mostrar a seta e sobreviver a reload.
const SORT_KEY = "__sortBy__";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { deny } = await requireUser();
  if (deny) return deny;

  const { id: baseId } = await params;
  const body = await req.json().catch(() => ({}));
  // colKey null/vazio = "sem ordenação ativa" (usado pelo desfazer, ao reverter para
  // antes do primeiro Classificar da base) — ainda assim grava a ordem das linhas.
  const colKey = typeof body?.colKey === "string" ? body.colKey : "";
  const dir = body?.dir === "desc" ? "desc" : "asc";
  const ids = Array.isArray(body?.ids) ? (body.ids as unknown[]).map(String).slice(0, 20000) : null;
  if (!ids) return NextResponse.json({ error: "ids inválidos" }, { status: 400 });

  const base = await prisma.base.findUnique({ where: { id: baseId }, select: { headers: true } });
  if (!base) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });

  if (colKey) {
    const customKeys = parseCustomCols(base.headers as Record<string, unknown> | null).map((c) => c.key);
    if (!CONTACT_FIELD_KEYS.includes(colKey) && !customKeys.includes(colKey)) {
      return NextResponse.json({ error: "Coluna inválida" }, { status: 400 });
    }
  }

  await ensureContactOrdemColuna();

  // Só grava ordem para ids que realmente pertencem a esta base (ignora o resto —
  // evita que uma base escreva ordem em contatos de outra).
  const pertencem = await prisma.contact.findMany({ where: { baseId, id: { in: ids } }, select: { id: true } });
  const validos = new Set(pertencem.map((c) => c.id));
  const ordenados = ids.filter((i) => validos.has(i));

  if (ordenados.length > 0) {
    const tuplas = ordenados.map((cid, i) => Prisma.sql`(${cid}::text, ${i}::int)`);
    await prisma.$executeRaw`
      UPDATE "Contact" AS c
      SET "ordem" = v.ordem
      FROM (VALUES ${Prisma.join(tuplas)}) AS v(id, ordem)
      WHERE c.id = v.id AND c."baseId" = ${baseId}
    `;
  }

  const current = ((base.headers as Record<string, unknown> | null) || {}) as Record<string, unknown>;
  if (colKey) {
    const nextHeaders = { ...current, [SORT_KEY]: { key: colKey, dir } } as Prisma.InputJsonValue;
    await prisma.base.update({ where: { id: baseId }, data: { headers: nextHeaders } });
  } else {
    // sem coluna ativa (desfazendo o primeiro Classificar): limpa o indicador.
    const { [SORT_KEY]: _removed, ...resto } = current;
    void _removed;
    await prisma.base.update({ where: { id: baseId }, data: { headers: resto as Prisma.InputJsonValue } });
  }

  return NextResponse.json({ ok: true, atualizados: ordenados.length });
}
