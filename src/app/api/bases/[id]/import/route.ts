import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { parseSpreadsheetWithMeta, looksLikeValidPhone, validateSpreadsheetFile, type ImportedRow } from "@/lib/import";
import { PHONE_FIELD } from "@/lib/contact-fields";
import { ensureContactCustomTable } from "@/lib/custom-columns";
import { parseCustomCols, type CustomCol } from "@/lib/base-columns";
import {
  ensureBaseEventoTable,
  type MergeSnapshot,
  type ReplaceSnapshot,
} from "@/lib/base-eventos";

// Planilhas maiores (muitas linhas × várias colunas personalizadas) podem
// passar dos ~10s padrão da função — medido ~48s numa planilha real de 94
// linhas × 7 colunas personalizadas.
export const maxDuration = 60;

// Linha já sem __customValues (que fica à parte, em `custom`) — o resto do
// arquivo trabalha só com isso, sem se preocupar com a chave especial.
type RowInput = { data: Record<string, string>; custom: Record<string, string> };

function slugifyHeader(header: string): string {
  const norm = header
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
  const slug = norm.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  return "c_" + (slug || Math.random().toString(36).slice(2, 8));
}

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
  const email = normalizeText(contact.emailInstitucional);
  // Cidade+UF sozinho valia pra prefeitura (só existe uma por cidade), mas
  // descartava registros legítimos de bases onde a mesma cidade tem vários
  // contatos — ex.: consórcios (Florianópolis tem 4). O e-mail entra na chave
  // pra diferenciá-los; sem e-mail, mantém o comportamento antigo (cidade+UF).
  if (cidade && estado) return email ? `cidade:${estado}:${cidade}:${email}` : `cidade:${estado}:${cidade}`;

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
  // Contexto de região (base acessada via ?regiao=X, ex.: card de região clicado).
  // Sem isso, uma planilha sem coluna de região reconhecida deixa os contatos com
  // região em branco — e eles somem da tela ao abrir a base filtrada por região
  // (o filtro exige bater exatamente com o valor da URL).
  const regiaoContexto = String(form.get("regiao") || "").trim() || null;
  if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const fileError = validateSpreadsheetFile(file);
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseSpreadsheetWithMeta(buffer, file.name);
  if (regiaoContexto) {
    for (const row of parsed.rows) {
      if (!row.regiao || !row.regiao.trim()) row.regiao = regiaoContexto;
    }
  }

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

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      { error: "Não encontrei contatos. Verifique se a planilha tem cabeçalho (Cidade, Telefone, etc.)." },
      { status: 400 }
    );
  }

  // Separa os campos reconhecidos (`data`) dos valores de colunas NÃO
  // reconhecidas (`custom`, chave = cabeçalho original) — o resto do arquivo
  // trabalha só com `data`; `custom` é gravado à parte, em ContactCustomValue.
  const rows: RowInput[] = parsed.rows.map((r) => {
    const { __customValues, ...data } = r as ImportedRow;
    return { data, custom: __customValues || {} };
  });

  // Colunas personalizadas a partir dos cabeçalhos não reconhecidos: reaproveita
  // a coluna já existente se o RÓTULO já bater (evita duplicar numa reimportação);
  // senão cria uma chave nova e estável (não muda a cada import do mesmo arquivo).
  const oldHeadersRaw = (base.headers as Record<string, unknown> | null) || {};
  const existingCols = parseCustomCols(oldHeadersRaw);
  const byLabel = new Map(existingCols.map((c) => [c.label.trim().toLowerCase(), c] as const));
  const usedKeys = new Set(existingCols.map((c) => c.key));
  const headerToCol = new Map<string, CustomCol>();
  for (const header of parsed.unknownColumns) {
    const found = byLabel.get(header.trim().toLowerCase());
    if (found) { headerToCol.set(header, found); continue; }
    let key = slugifyHeader(header);
    while (usedKeys.has(key)) key = slugifyHeader(header + Math.random());
    usedKeys.add(key);
    const col: CustomCol = { key, label: header.slice(0, 60) };
    headerToCol.set(header, col);
  }
  // "Substituir" com troca de rótulos: o conjunto de colunas personalizadas vira
  // EXATAMENTE o da planilha atual — as de antes que não estão mais nela somem.
  // Em qualquer outro caso (mesclar, ou substituir mantendo rótulos): só
  // ACRESCENTA colunas novas, nunca remove uma que já existia.
  const fullReplaceCols = mode === "replace" && replaceColumns;
  const newColsForHeaders: CustomCol[] = fullReplaceCols
    ? Array.from(headerToCol.values())
    : (() => {
        const merged = new Map(existingCols.map((c) => [c.key, c] as const));
        for (const col of headerToCol.values()) merged.set(col.key, col);
        return Array.from(merged.values()).slice(0, 30);
      })();

  // @ts-expect-error id custom na sessão
  const userId: string | null = session.user.id ?? null;

  // Cria os contatos de uma lista de linhas + a fila de correção dos telefones
  // inválidos + os valores de colunas personalizadas (best-effort — se falhar,
  // os contatos já foram criados normalmente, só o extra que não entra).
  async function createRows(newRows: RowInput[]) {
    let invalid = 0;
    const created = await prisma.$transaction(
      newRows.map((r) => {
        const validPhone = looksLikeValidPhone(r.data[PHONE_FIELD]);
        if (!validPhone) invalid++;
        return prisma.contact.create({
          data: { baseId: id, createdById: userId, ...r.data, status: validPhone ? "ok" : "telefone_incorreto" },
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
    await writeCustomValues(created.map((c, i) => ({ contactId: c.id, custom: newRows[i].custom })));
    return { created, invalid };
  }

  // Grava vários valores de coluna personalizada numa ÚNICA consulta (em lotes),
  // em vez de 1 INSERT por valor — com uma planilha de ~100 linhas × várias
  // colunas personalizadas, um INSERT por valor vira centenas de idas ao banco
  // em série (bem lento, especialmente via pooler). Multi-row VALUES resolve.
  async function bulkUpsertCustomValues(rowsToWrite: { contactId: string; colKey: string; valor: string }[]) {
    if (rowsToWrite.length === 0) return;
    await ensureContactCustomTable();
    const CHUNK = 200;
    for (let i = 0; i < rowsToWrite.length; i += CHUNK) {
      const chunk = rowsToWrite.slice(i, i + CHUNK);
      const placeholders: string[] = [];
      const params: string[] = [];
      chunk.forEach((r, idx) => {
        const base = idx * 3;
        placeholders.push(`($${base + 1},$${base + 2},$${base + 3})`);
        params.push(r.contactId, r.colKey, r.valor);
      });
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ContactCustomValue" ("contactId","colKey","valor") VALUES ${placeholders.join(",")}
         ON CONFLICT ("contactId","colKey") DO UPDATE SET valor = EXCLUDED.valor`,
        ...params
      );
    }
  }

  // Grava os valores de colunas personalizadas de contatos NOVOS — sempre grava
  // o que veio da planilha (não tem valor anterior pra preservar).
  async function writeCustomValues(items: { contactId: string; custom: Record<string, string> }[]) {
    const rowsToWrite: { contactId: string; colKey: string; valor: string }[] = [];
    for (const item of items) {
      for (const [header, valor] of Object.entries(item.custom)) {
        const col = headerToCol.get(header);
        if (!col || !valor.trim()) continue;
        rowsToWrite.push({ contactId: item.contactId, colKey: col.key, valor });
      }
    }
    await bulkUpsertCustomValues(rowsToWrite);
  }

  // Igual a writeCustomValues, mas pra contato JÁ EXISTENTE (modo mesclar): só
  // grava se ele ainda não tinha valor nessa coluna — mesmo espírito de "completa
  // o que falta" já aplicado aos campos nativos, não sobrescreve o que já tinha.
  async function writeCustomValuesIfBlank(items: { contactId: string; custom: Record<string, string> }[]) {
    const pairs = items.flatMap((item) =>
      Object.entries(item.custom)
        .filter(([, v]) => v.trim())
        .map(([header, valor]) => ({ contactId: item.contactId, header, valor }))
    );
    if (pairs.length === 0) return;
    await ensureContactCustomTable();
    const contactIds = Array.from(new Set(pairs.map((p) => p.contactId)));
    const existingVals = await prisma.$queryRawUnsafe<{ contactId: string; colKey: string; valor: string | null }[]>(
      `SELECT "contactId","colKey","valor" FROM "ContactCustomValue" WHERE "contactId" = ANY($1)`,
      contactIds
    );
    const hasValue = new Set(
      existingVals.filter((v) => v.valor && v.valor.trim()).map((v) => `${v.contactId}:${v.colKey}`)
    );
    const rowsToWrite: { contactId: string; colKey: string; valor: string }[] = [];
    for (const p of pairs) {
      const col = headerToCol.get(p.header);
      if (!col || hasValue.has(`${p.contactId}:${col.key}`)) continue;
      rowsToWrite.push({ contactId: p.contactId, colKey: col.key, valor: p.valor });
    }
    await bulkUpsertCustomValues(rowsToWrite);
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
    // As chaves reservadas (__order__, __hidden__, __merges__, __sortBy__) são
    // ESTRUTURA, não rótulo: sobrevivem à substituição. __cols__ é a EXCEÇÃO
    // proposital aqui: quando troca os rótulos, as colunas personalizadas viram
    // exatamente as da planilha atual (newColsForHeaders já calculado assim).
    if (replaceColumns) {
      const estrutura = Object.fromEntries(
        Object.entries(oldHeaders).filter(([k]) => k.startsWith("__") && k.endsWith("__") && k !== "__cols__")
      );
      const newHeaders = {
        ...estrutura,
        __cols__: newColsForHeaders,
        ...Object.fromEntries(parsed.matchedColumns.map((c) => [c.field, c.header])),
      };
      await prisma.base.update({ where: { id }, data: { headers: newHeaders } });
    }

    const seenInFile = new Set<string>();
    const newRows: RowInput[] = [];
    for (const row of rows) {
      const key = dedupeKey(row.data);
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
    const toCreate: RowInput[] = [];
    const fills: { id: string; data: Record<string, string>; fields: string[] }[] = [];
    const customFillCandidates: { contactId: string; custom: Record<string, string> }[] = [];
    for (const row of rows) {
      const key = dedupeKey(row.data);
      if (!key) { skippedWithoutKey++; continue; }
      if (seenInFile.has(key)) { skippedInFile++; continue; }
      seenInFile.add(key);
      const match = byKey.get(key);
      if (!match) { toCreate.push(row); continue; }
      const rec = match as unknown as Record<string, string | null>;
      const data: Record<string, string> = {};
      const fields: string[] = [];
      for (const [field, value] of Object.entries(row.data)) {
        if (!value || !value.trim()) continue;
        const cur = rec[field];
        if (cur === null || cur === undefined || String(cur).trim() === "") {
          data[field] = value;
          fields.push(field);
        }
      }
      if (fields.length > 0) fills.push({ id: match.id, data, fields });
      else if (Object.keys(row.custom).length === 0) skippedNoChange++;
      if (Object.keys(row.custom).length > 0) customFillCandidates.push({ contactId: match.id, custom: row.custom });
    }

    const { created, invalid } = await createRows(toCreate);
    if (fills.length > 0) {
      await prisma.$transaction(fills.map((f) => prisma.contact.update({ where: { id: f.id }, data: { ...f.data } })));
    }
    await writeCustomValuesIfBlank(customFillCandidates);
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

  // Persiste as colunas personalizadas novas/atualizadas — exceto quando o bloco
  // "Substituir com troca de rótulos" acima já fez isso (senão gravaria 2x, e a
  // segunda vez usando `oldHeaders` desatualizado apagaria a primeira escrita).
  if (!fullReplaceCols) {
    const colsChanged = JSON.stringify(existingCols) !== JSON.stringify(newColsForHeaders);
    if (colsChanged) {
      const base2 = await prisma.base.findUnique({ where: { id }, select: { headers: true } });
      const headers2 = (base2?.headers as Record<string, unknown> | null) || {};
      await prisma.base.update({
        where: { id },
        data: { headers: { ...headers2, __cols__: newColsForHeaders } as Prisma.InputJsonValue },
      });
    }
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
