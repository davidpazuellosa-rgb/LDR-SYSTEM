import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { syncFromCrm } from "@/lib/crm-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // a sync paginada pode levar dezenas de segundos

// Dispara a sincronização com o HubSpot (somente leitura do CRM).
// `?force=1` ignora o throttle (botão "Sincronizar agora"); sem ele, respeita a
// janela de throttle (gatilhos automáticos da página).
export async function POST(req: Request) {
  const { deny } = await requireUser();
  if (deny) return deny;

  const force = new URL(req.url).searchParams.get("force") === "1";
  const result = await syncFromCrm({ force });
  return NextResponse.json(result);
}
