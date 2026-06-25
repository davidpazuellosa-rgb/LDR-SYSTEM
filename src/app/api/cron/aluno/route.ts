import { NextResponse } from "next/server";
import { importAlunoABordo } from "@/lib/aluno-a-bordo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cron próprio do Aluno a Bordo — cria/atualiza a base a partir das listas do HubSpot.
// Separado do /api/cron/sync pra cada job ter seu orçamento de tempo (Hobby = 60s).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const result = await importAlunoABordo();
  return NextResponse.json(result);
}
