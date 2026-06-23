import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { parseSpreadsheetWithMeta, looksLikeValidPhone, validateSpreadsheetFile } from "@/lib/import";
import { PHONE_FIELD } from "@/lib/contact-fields";

type DedupeContact = {
  codigoIbge?: string | null;
  cidade?: string | null;
  estado?: string | null;
  emailInstitucional?: string | null;
  telefonePrefeitura?: string | null;
};

function normalizeText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function onlyDigits(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

function dedupeKey(contact: DedupeContact) {
  const ibge = onlyDigits(contact.codigoIbge);
  if (ibge) return `ibge:${ibge}`;

  const cidade = normalizeText(contact.cidade);
  const estado = normalizeText(contact.estado);
  if (cidade && estado) return `cidade:${estado}:${cidade}`;

  const email = normalizeText(contact.emailInstitucional);
  if (email) return `email:${email}`;

  const phone = onlyDigits(contact.telefonePrefeitura);
  if (phone) return `telefone:${phone}`;

  return null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { deny } = await requirePermission("data.import");
  if (deny) return deny;

  const { id } = await params;
  const base = await prisma.base.findUnique({ where: { id } });
  if (!base) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const fileError = validateSpreadsheetFile(file);
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseSpreadsheetWithMeta(buffer, file.name);
  const rows = parsed.rows;

  if (parsed.missingRequiredColumns.length > 0) {
    return NextResponse.json(
      {
        error: `A planilha não tem as colunas obrigatórias: ${parsed.missingRequiredColumns.join(", ")}.`,
        missingColumns: parsed.missingRequiredColumns,
        unknownColumns: parsed.unknownColumns,
        matchedColumns: parsed.matchedColumns,
      },
      { status: 400 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Não encontrei contatos. Verifique se a planilha tem cabeçalho (Cidade, Telefone, etc.)." },
      { status: 400 }
    );
  }

  const existingContacts = await prisma.contact.findMany({
    where: { baseId: id },
    select: {
      codigoIbge: true,
      cidade: true,
      estado: true,
      emailInstitucional: true,
      telefonePrefeitura: true,
    },
  });
  const existingKeys = new Set(existingContacts.map(dedupeKey).filter(Boolean));
  const importedKeys = new Set<string>();
  const newRows = [];
  let skippedExisting = 0;
  let skippedInFile = 0;
  let skippedWithoutKey = 0;

  for (const row of rows) {
    const key = dedupeKey(row);
    if (!key) {
      skippedWithoutKey++;
      continue;
    }

    if (existingKeys.has(key)) {
      skippedExisting++;
      continue;
    }

    if (importedKeys.has(key)) {
      skippedInFile++;
      continue;
    }

    importedKeys.add(key);
    newRows.push(row);
  }

  let invalidCount = 0;
  await prisma.$transaction(
    newRows.map((r) => {
      const phone = r[PHONE_FIELD];
      const validPhone = looksLikeValidPhone(phone);
      if (!validPhone) invalidCount++;
      return prisma.contact.create({
        data: {
          baseId: id,
          ...r,
          status: validPhone ? "ok" : "telefone_incorreto",
        },
      });
    })
  );

  await prisma.base.update({ where: { id }, data: { source: "import" } });

  return NextResponse.json({
    imported: newRows.length,
    received: rows.length,
    invalid: invalidCount,
    skippedExisting,
    skippedInFile,
    skippedWithoutKey,
    unknownColumns: parsed.unknownColumns,
    matchedColumns: parsed.matchedColumns,
  });
}
