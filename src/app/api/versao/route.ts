import { NextResponse } from "next/server";
import { VERSAO_ATUAL } from "@/lib/versao";

export const dynamic = "force-dynamic";

// Público e leve: devolve só o identificador da publicação em execução. A tela compara com o
// que ela carregou e, se mudou, mostra o aviso "Nova versão disponível" com o botão Recarregar.
export async function GET() {
  return NextResponse.json({ versao: VERSAO_ATUAL }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
