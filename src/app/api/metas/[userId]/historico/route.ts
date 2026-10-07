import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { buildMinhasMetas } from "@/lib/minhas-metas";

export const dynamic = "force-dynamic";

// Histórico de metas de UM LDR, para o admin ver de dentro de "Metas da Equipe"
// (expandido no card). Não marca como "visto" — é o admin olhando, não o próprio LDR.
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { deny } = await requireAdmin();
  if (deny) return deny;
  const { userId } = await params;
  const { historico } = await buildMinhasMetas(userId, { marcarVistoAoAbrir: false });
  return NextResponse.json({ historico });
}
