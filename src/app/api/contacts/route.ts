import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { looksLikeValidPhone } from "@/lib/import";
import { CONTACT_FIELD_KEYS, PHONE_FIELD } from "@/lib/contact-fields";
import { STATUS_OK, STATUS_INCORRETO } from "@/lib/status";

// Cadastro manual de um novo contato (prefeitura) dentro de uma base.
export async function POST(req: Request) {
  const { session, deny } = await requireUser();
  if (deny) return deny;

  const body = await req.json();
  const baseId = String(body?.baseId || "");
  if (!baseId) return NextResponse.json({ error: "baseId obrigatório" }, { status: 400 });

  const data: Record<string, string | null> = {};
  for (const key of CONTACT_FIELD_KEYS) {
    data[key] = body?.[key] ? String(body[key]) : null;
  }

  // Sem região informada, herda a das linhas que a UF (ou a base) já tem — senão a
  // linha nova ficaria "sem região" e sumiria ao abrir a base pelo card de uma região.
  if (!data.regiao) {
    const ref = await prisma.contact.findFirst({
      where: { baseId, deletedAt: null, regiao: { not: null }, ...(data.estado ? { estado: data.estado } : {}) },
      select: { regiao: true },
    });
    data.regiao = ref?.regiao ?? null;
  }

  const phone = data[PHONE_FIELD];
  const contact = await prisma.contact.create({
    data: {
      baseId,
      // @ts-expect-error id custom na sessão
      createdById: session.user.id ?? null,
      ...data,
      status: looksLikeValidPhone(phone) ? STATUS_OK : phone ? STATUS_INCORRETO : STATUS_OK,
    },
  });
  return NextResponse.json(contact);
}
