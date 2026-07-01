import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { parseSpreadsheetWithMeta, looksLikeValidPhone, validateSpreadsheetFile, type ImportedRow } from "@/lib/import";
import { PHONE_FIELD } from "@/lib/contact-fields";
import {
  ensureBaseEventoTable,
  type MergeSnapshot,
  type ReplaceSnapshot,
} from "@/lib/base-eventos";

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
  const { session, deny } = await requirePermission("data.import");
  if (deny) return deny;

  const { id } = await params;
  const base = await prisma.base.findUnique({ where: { id } });
  if (!base) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  // "merge" (padrão): completa campos vazios + adiciona novos.
  // "replace": substitui tudo (apaga reversível) e importa do zero.
  const mode = String(form.get("mode") || "merge") === "replace" ? "replace" : "merge";
  // Em "replace": se true, os RÓTULOS das colunas passam a ser os nomes da planilha
  // importada; se false, mantém os rótulos atuais (só troca as linhas).
  const replaceColumns = String(form.get("replaceColumns") || "") === "true";
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

  // @ts-expect-error id custom na sessão
  const userId: string | null = session.user.id ?? null;

  // Cria os contatos de uma lista de linhas + a fila de correção dos telefones inválidos.
  async function createRows(newRows: ImportedRow[]) {
    let invalid = 0;
    const created = await prisma.$transaction(
      newRows.map((r) => {
        const validPhone = looksLikeValidPhone(r[PHONE_FIELD]);
        if (!validPhone) invalid++;
        return prisma.contact.create({
          data: { baseId: id, createdById: userId, ...r, status: validPhone ? "ok" : "telefone_incorreto" },
        });
      })
    );
    const invalidContacts = created.filter((c) => c.status === "telefone_incorreto");
    if (invalidContacts.length > 0) {
      await prisma.correction.createMany({
        data: invalidContacts.map((c) => ({
          contactId: c.id,
          field: "telefonePrefeitura",
          oldValue: c.telefonePrefeitura,
          reason: "Telefone inválido detectado na importação",
          status: "pending",
          createdById: userId,
        })),
      });
    }
    return { created, invalid };
  }

  let skippedWithoutKey = 0;
  let skippedInFile = 0;
  let skippedNoChange = 0;
  let snapshot: MergeSnapshot | ReplaceSnapshot;
  let detalhes: Record<string, number>;
  let imported = 0;
  let completados = 0;
  let substituidos = 0;
  let invalidCount = 0;

  if (mode === "replace") {
    // Substituir: soft-delete (reversível) dos contatos atuais + reset dos rótulos de coluna.
    const existing = await prisma.contact.findMany({ where: { baseId: id, deletedAt: null }, select: { id: true } });
    const deletedIds = existing.map((c) => c.id);
    const oldHeaders = (base.headers as Record<string, string> | null) || {};
    if (deletedIds.length > 0) {
      await prisma.contact.updateMany({ where: { id: { in: deletedIds } }, data: { deletedAt: new Date() } });
    }
    // Rótulos das colunas: só troca se o usuário pediu (senão, mantém os atuais).
    if (replaceColumns) {
      const newHeaders = Object.fromEntries(parsed.matchedColumns.map((c) => [c.field, c.header]));
      await prisma.base.update({ where: { id }, data: { headers: newHeaders } });
    }

    const seenInFile = new Set<string>();
    const newRows: ImportedRow[] = [];
    for (const row of rows) {
      const key = dedupeKey(row);
      if (!key) { skippedWithoutKey++; continue; }
      if (seenInFile.has(key)) { skippedInFile++; continue; }
      seenInFile.add(key);
      newRows.push(row);
    }
    const { created, invalid } = await createRows(newRows);
    imported = created.length;
    substituidos = deletedIds.length;
    invalidCount = invalid;
    snapshot = { kind: "replace", deletedIds, createdIds: created.map((c) => c.id), oldHeaders };
    detalhes = { substituidos, criados: imported, invalidos: invalid, semChave: skippedWithoutKey, duplicadosNoArquivo: skippedInFile };
  } else {
    // Mesclar: completa só campos vazios dos existentes + adiciona os novos.
    const existing = await prisma.contact.findMany({ where: { baseId: id, deletedAt: null } });
    const byKey = new Map<string, (typeof existing)[number]>();
    for (const c of existing) {
      const k = dedupeKey(c);
      if (k && !byKey.has(k)) byKey.set(k, c);
    }

    const seenInFile = new Set<string>();
    const toCreate: ImportedRow[] = [];
    const fills: { id: string; data: Record<string, string>; fields: string[] }[] = [];
    for (const row of rows) {
      const key = dedupeKey(row);
      if (!key) { skippedWithoutKey++; continue; }
      if (seenInFile.has(key)) { skippedInFile++; continue; }
      seenInFile.add(key);
      const match = byKey.get(key);
      if (!match) { toCreate.push(row); continue; }
      const rec = match as unknown as Record<string, string | null>;
      const data: Record<string, string> = {};
      const fields: string[] = [];
      for (const [field, value] of Object.entries(row)) {
        if (!value || !value.trim()) continue;
        const cur = rec[field];
        if (cur === null || cur === undefined || String(cur).trim() === "") {
          data[field] = value;
          fields.push(field);
        }
      }
      if (fields.length > 0) fills.push({ id: match.id, data, fields });
      else skippedNoChange++;
    }

    const { created, invalid } = await createRows(toCreate);
    if (fills.length > 0) {
      await prisma.$transaction(fills.map((f) => prisma.contact.update({ where: { id: f.id }, data: { ...f.data } })));
    }
    imported = created.length;
    completados = fills.length;
    invalidCount = invalid;
    snapshot = {
      kind: "merge",
      createdIds: created.map((c) => c.id),
      fills: fills.map((f) => ({ contactId: f.id, fields: f.fields })),
    };
    detalhes = {
      criados: imported,
      completados,
      invalidos: invalid,
      semChave: skippedWithoutKey,
      duplicadosNoArquivo: skippedInFile,
      semMudanca: skippedNoChange,
    };
  }

  await prisma.base.update({ where: { id }, data: { source: "import" } });

  // Registra o evento imutável no histórico (quem fez + snapshot para desfazer).
  await ensureBaseEventoTable();
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
    : null;
  const evento = await prisma.baseEvento.create({
    data: {
      baseId: id,
      tipo: mode === "replace" ? "import_replace" : "import_merge",
      usuarioId: userId,
      usuarioNome: user?.name ?? user?.email ?? null,
      detalhes: detalhes as Prisma.InputJsonValue,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  return NextResponse.json({
    mode,
    eventoId: evento.id,
    imported,
    completados,
    substituidos,
    received: rows.length,
    invalid: invalidCount,
    skippedExisting: 0,
    skippedInFile,
    skippedWithoutKey,
    skippedNoChange,
    unknownColumns: parsed.unknownColumns,
    matchedColumns: parsed.matchedColumns,
  });
}
