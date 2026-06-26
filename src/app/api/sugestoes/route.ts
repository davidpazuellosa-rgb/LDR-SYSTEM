import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { ensureSuggestionTable } from "@/lib/suggestions";

export const dynamic = "force-dynamic";

const MAX_AUDIO = 4_000_000; // ~4MB de data URL base64 (≈ 2 min de voz)

// Qualquer usuário logado pode enviar uma sugestão de melhoria.
export async function POST(req: Request) {
  const { session, deny } = await requireUser();
  if (deny) return deny;
  const u = session?.user as { id?: string; name?: string | null; email?: string | null } | undefined;

  const body = await req.json().catch(() => ({}));
  const texto = typeof body?.texto === "string" ? body.texto.trim() : "";
  let audio = typeof body?.audio === "string" ? body.audio : null;
  if (audio && (!audio.startsWith("data:audio") || audio.length > MAX_AUDIO)) audio = null;
  if (!texto && !audio) {
    return NextResponse.json({ error: "Escreva ou grave a sua sugestão." }, { status: 400 });
  }

  await ensureSuggestionTable();
  await prisma.suggestion.create({
    data: {
      usuarioId: u?.id || null,
      usuarioNome: u?.name || u?.email || null,
      texto: texto || "(somente áudio)",
      audio,
    },
  });
  return NextResponse.json({ ok: true });
}
