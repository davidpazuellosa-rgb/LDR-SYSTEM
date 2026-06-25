import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { importAlunoABordo } from "@/lib/aluno-a-bordo";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // puxa 8 listas + cria/atualiza a base

// Cria/atualiza a base "Aluno a Bordo" a partir das listas do HubSpot.
export async function POST() {
  const { deny } = await requireUser();
  if (deny) return deny;
  const result = await importAlunoABordo();
  return NextResponse.json(result);
}
