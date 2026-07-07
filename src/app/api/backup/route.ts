import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { statusBackup, runBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Status do backup automático (admin) — para exibir em Configurações.
export async function GET() {
  const { deny } = await requireAdmin();
  if (deny) return deny;
  return NextResponse.json(await statusBackup());
}

// Dispara um backup manual agora (admin) — útil para testar a configuração.
export async function POST() {
  const { deny } = await requireAdmin();
  if (deny) return deny;
  const result = await runBackup();
  return NextResponse.json(result);
}
