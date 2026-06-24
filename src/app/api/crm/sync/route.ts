import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { syncFromCrm } from "@/lib/crm-sync";

// Dispara a sincronização manual com o HubSpot.
// Qualquer usuário autenticado pode chamar — a sync é somente leitura do CRM.
export async function POST() {
  const { deny } = await requireUser();
  if (deny) return deny;

  const result = await syncFromCrm();
  return NextResponse.json(result);
}
