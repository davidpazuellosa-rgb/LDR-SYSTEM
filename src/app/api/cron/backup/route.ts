import { NextResponse } from "next/server";
import { runBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Backup diário do banco (Vercel Cron) — dump lógico de todas as tabelas para o
// Supabase Storage, com retenção. Protegido pelo CRON_SECRET, igual aos outros crons.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const result = await runBackup();
  return NextResponse.json(result);
}
