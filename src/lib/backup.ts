// Backup automático do banco de produção (PostgreSQL/Supabase) — para não depender
// só do soft-delete dentro do app. Faz um dump lógico (SELECT * de cada tabela) em
// JSON, comprime e sobe para um bucket do Supabase Storage (privado), com retenção.
//
// Requer 3 variáveis de ambiente (nenhuma delas é a chave pública do app):
//   NEXT_PUBLIC_SUPABASE_URL          (já existe, usada também pelo Realtime)
//   SUPABASE_SERVICE_ROLE_KEY         (secreta — Supabase → Project Settings → API)
//   SUPABASE_BACKUP_BUCKET            (opcional, default "backups")
// Sem elas, degrada com elegância: retorna { ok:false, reason } sem quebrar nada.
import { createClient } from "@supabase/supabase-js";
import { gzipSync } from "node:zlib";
import { prisma } from "@/lib/prisma";

const BUCKET = process.env.SUPABASE_BACKUP_BUCKET || "backups";
const RETENTION_DIAS = Number(process.env.BACKUP_RETENTION_DAYS || 14);

// Todas as tabelas do sistema — inclusive as criadas sob demanda via SQL cru
// (Meta, MetaSnapshot, MetaVisto, ContactFill, ContactCustomValue, BaseEvento,
// Suggestion, UserProprietario), que não migram por fora e por isso não têm
// backup automático nenhum além deste.
const TABELAS = [
  "User", "Base", "Contact", "Scan", "Correction",
  "ContactFill", "Meta", "MetaSnapshot", "MetaVisto",
  "ContactCustomValue", "BaseEvento", "Suggestion", "UserProprietario",
];

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function backupConfigurado(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Lista de tabela -> nome real no Postgres não muda; SELECT * captura colunas
// novas automaticamente (não precisa manter em sincronia com o schema).
async function dumpTabela(nome: string): Promise<unknown[]> {
  try {
    return await prisma.$queryRawUnsafe<unknown[]>(`SELECT * FROM "${nome}"`);
  } catch {
    // Tabela ainda não existe (nunca foi usada) — não é erro, backup segue sem ela.
    return [];
  }
}

export async function runBackup(): Promise<
  { ok: true; file: string; sizeBytes: number; tabelas: number; removidos: number } | { ok: false; error: string }
> {
  const supa = getAdminClient();
  if (!supa) return { ok: false, error: "Backup não configurado (faltam variáveis do Supabase)." };

  try {
    const data: Record<string, unknown[]> = {};
    for (const t of TABELAS) data[t] = await dumpTabela(t);

    const payload = JSON.stringify({ criadoEm: new Date().toISOString(), tabelas: data });
    const gz = gzipSync(Buffer.from(payload, "utf8"));

    const nomeArquivo = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json.gz`;
    const up = await supa.storage.from(BUCKET).upload(nomeArquivo, gz, {
      contentType: "application/gzip",
      upsert: false,
    });
    if (up.error) return { ok: false, error: `Falha ao enviar backup: ${up.error.message}` };

    const removidos = await aplicarRetencao(supa);
    return { ok: true, file: nomeArquivo, sizeBytes: gz.length, tabelas: TABELAS.length, removidos };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Apaga backups mais antigos que a retenção configurada (default 14 dias).
async function aplicarRetencao(supa: NonNullable<ReturnType<typeof getAdminClient>>): Promise<number> {
  const { data: files } = await supa.storage.from(BUCKET).list("", { limit: 1000, sortBy: { column: "name", order: "desc" } });
  if (!files) return 0;
  const limite = Date.now() - RETENTION_DIAS * 86400000;
  const antigos = files.filter((f) => {
    const t = f.created_at ? new Date(f.created_at).getTime() : 0;
    return t > 0 && t < limite;
  });
  if (antigos.length === 0) return 0;
  await supa.storage.from(BUCKET).remove(antigos.map((f) => f.name));
  return antigos.length;
}

export async function statusBackup(): Promise<{
  configurado: boolean;
  retencaoDias: number;
  ultimo: { file: string; sizeBytes: number; criadoEm: string } | null;
}> {
  const supa = getAdminClient();
  if (!supa) return { configurado: false, retencaoDias: RETENTION_DIAS, ultimo: null };
  const { data: files } = await supa.storage.from(BUCKET).list("", { limit: 1, sortBy: { column: "name", order: "desc" } });
  const last = files?.[0];
  return {
    configurado: true,
    retencaoDias: RETENTION_DIAS,
    ultimo: last ? { file: last.name, sizeBytes: last.metadata?.size ?? 0, criadoEm: last.created_at ?? "" } : null,
  };
}
