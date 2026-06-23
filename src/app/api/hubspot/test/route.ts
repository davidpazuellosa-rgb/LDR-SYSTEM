import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { testHubspotConnection } from "@/lib/hubspot";

// Verifica a conexão com o HubSpot (read-only). Não envia nem lê dados do CRM.
export async function GET() {
  const { deny } = await requireUser();
  if (deny) return deny;

  const result = await testHubspotConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
