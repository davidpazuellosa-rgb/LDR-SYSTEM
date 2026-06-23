import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { scanOrgContacts } from "@/lib/groq";

type Params = {
  params: Promise<{ id: string }>;
};

function hasUsablePhone(contact: unknown) {
  if (!contact || typeof contact !== "object") return false;

  const telefone = String((contact as { telefone?: unknown }).telefone || "");
  const digits = telefone.replace(/\D/g, "");
  const normalized = digits.startsWith("55") ? digits.slice(2) : digits;

  return normalized.length === 10 || normalized.length === 11;
}

function serializeScan(scan: {
  id: string;
  ok: boolean;
  data: unknown;
  error: string | null;
  summary: string | null;
  model: string | null;
  createdAt: Date;
}) {
  return {
    id: scan.id,
    ok: scan.ok,
    contatos: Array.isArray(scan.data) ? scan.data.filter(hasUsablePhone) : [],
    error: scan.error,
    resumo: scan.summary,
    model: scan.model,
    createdAt: scan.createdAt.toISOString(),
  };
}

export async function GET(_req: Request, { params }: Params) {
  const { deny } = await requireUser();
  if (deny) return deny;

  const { id } = await params;
  const scan = await prisma.scan.findFirst({
    where: { contactId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(scan ? { ok: true, scan: serializeScan(scan) } : { ok: true, scan: null });
}

export async function POST(_req: Request, { params }: Params) {
  const { deny } = await requireUser();
  if (deny) return deny;

  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    select: {
      id: true,
        cidade: true,
        estado: true,
        nomePrefeito: true,
        siteOficial: true,
        telefonePrefeitura: true,
      },
    });

  if (!contact) {
    return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
  }

  const result = await scanOrgContacts(contact);
  const scan = await prisma.scan.create({
    data: {
      contactId: id,
      ok: result.ok,
      data: result.ok ? result.contatos : [],
      error: result.ok ? null : result.error,
      summary: result.ok ? result.resumo : null,
      model: process.env.GROQ_MODEL || "groq/compound-mini",
    },
  });

  const body = serializeScan(scan);
  return NextResponse.json({ ...body, scan: body }, { status: result.ok ? 200 : 400 });
}
