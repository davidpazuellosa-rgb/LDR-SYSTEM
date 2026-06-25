import { NextResponse } from "next/server";
import { syncFromCrm } from "@/lib/crm-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sincronização agendada do Cidade na Mão (Vercel Cron) — mantém a base atualizada
// mesmo quando ninguém está com a tela aberta. Configurada em vercel.json.
// Protegida pelo CRON_SECRET: se a env existir, exige o header Authorization
// que a Vercel envia automaticamente nos cron jobs.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const result = await syncFromCrm({ force: true });
  return NextResponse.json(result);
}
