import { NextResponse } from "next/server";
import { snapshotMetas } from "@/lib/minhas-metas";
import { limparCelulaLog } from "@/lib/auditoria";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Congela o resultado das metas do período recém-encerrado (Vercel Cron). Idempotente:
// rodar todo dia só grava o período que acabou uma única vez (chave única). Protegido
// pelo CRON_SECRET, igual aos outros crons.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const result = await snapshotMetas();
  // Aproveita o cron diário para apagar o histórico de células com mais de 90 dias.
  const apagados = await limparCelulaLog().catch(() => -1);
  return NextResponse.json({ ...result, celulaLogApagados: apagados });
}
