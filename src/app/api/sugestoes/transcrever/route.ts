import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { transcribeAudio } from "@/lib/transcribe";

export const dynamic = "force-dynamic";

const MAX = 6_000_000; // ~6MB (limite de corpo do serverless é ~4.5MB; aqui é folga)

// Recebe o áudio gravado e devolve a transcrição (Groq Whisper).
export async function POST(req: Request) {
  const { deny } = await requireUser();
  if (deny) return deny;

  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Áudio não recebido." }, { status: 400 });
  }
  if (file.size > MAX) {
    return NextResponse.json({ error: "Áudio muito longo (máx ~2 min)." }, { status: 413 });
  }
  const r = await transcribeAudio(file);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ text: r.text });
}
