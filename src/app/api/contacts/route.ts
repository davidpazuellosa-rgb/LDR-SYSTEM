import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { looksLikeValidPhone } from "@/lib/import";
import { CONTACT_FIELD_KEYS, PHONE_FIELD } from "@/lib/contact-fields";
import { STATUS_OK, STATUS_INCORRETO } from "@/lib/status";
import { parseCustomCols } from "@/lib/base-columns";
import { PAGINA_COL, parsePaginas } from "@/lib/base-abas";
import { ensureContactCustomTable } from "@/lib/custom-columns";

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

  // Colunas de lista suspensa com VALOR PADRÃO: a linha inserida à mão já nasce com ele.
  // (Só aqui — linhas em branco de página nova e importação não recebem padrão, senão
  // virariam "linha com dado" nos contadores.)
  const base = await prisma.base.findUnique({ where: { id: baseId }, select: { headers: true } });
  // Linha inserida DENTRO de uma página livre já nasce nela.
  const pagina = body?.pagina ? String(body.pagina) : null;
  if (pagina && parsePaginas(base?.headers as Record<string, unknown> | null).includes(pagina)) {
    await ensureContactCustomTable();
    await prisma.contactCustomValue.upsert({
      where: { contactId_colKey: { contactId: contact.id, colKey: PAGINA_COL } },
      create: { contactId: contact.id, colKey: PAGINA_COL, valor: pagina },
      update: { valor: pagina },
    });
  }
  const padroes = parseCustomCols(base?.headers as Record<string, unknown> | null).filter((c) => c.tipo === "lista" && c.padrao);
  if (padroes.length) {
    await ensureContactCustomTable();
    await prisma.contactCustomValue.createMany({
      data: padroes.map((c) => ({ contactId: contact.id, colKey: c.key, valor: c.padrao as string })),
      skipDuplicates: true,
    });
  }
  return NextResponse.json(contact);
}
