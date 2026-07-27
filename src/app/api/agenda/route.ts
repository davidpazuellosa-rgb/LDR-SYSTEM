import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { fetchOwners, fetchAllMeetings, enrichMeetings } from "@/lib/agenda";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // busca paginada + enriquecimento pode levar dezenas de segundos

// Lista as reuniões do HubSpot (somente leitura) para a Agenda.
// Qualquer usuário logado pode ver (todos os acessos).
export async function GET(req: Request) {
  const { deny } = await requireUser();
  if (deny) return deny;

  const token = process.env.HUBSPOT_TOKEN;
  if (!token) {
    return NextResponse.json({ available: false, error: "HUBSPOT_TOKEN não configurado no servidor." });
  }

  try {
    const [owners, meetings] = await Promise.all([fetchOwners(token), fetchAllMeetings(token)]);
    // Enriquecimento é best-effort: sem contato/negócio a Agenda ainda funciona.
    try {
      await enrichMeetings(token, meetings);
    } catch {
      // segue sem os campos de contato/negócio
    }
    const fresh = new URL(req.url).searchParams.get("fresh") === "1";
    return NextResponse.json(
      { available: true, meetings, owners, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": fresh ? "no-store" : "s-maxage=120, stale-while-revalidate=600",
        },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ available: false, error: msg });
  }
}
