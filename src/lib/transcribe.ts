// Transcrição de áudio via Groq (Whisper). Usa a mesma GROQ_API_KEY do agente.
type Result = { ok: true; text: string } | { ok: false; error: string };

export async function transcribeAudio(file: Blob): Promise<Result> {
  const token = process.env.GROQ_API_KEY;
  if (!token) return { ok: false, error: "GROQ_API_KEY não configurada." };
  const model = process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo";

  // FormData nova a cada tentativa (o corpo é consumido pelo fetch).
  const buildForm = () => {
    const form = new FormData();
    form.append("file", file, "sugestao.webm");
    form.append("model", model);
    form.append("language", "pt");
    form.append("response_format", "json");
    return form;
  };
  const call = () =>
    fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: buildForm(),
    });

  try {
    let res = await call();
    // Plano gratuito do Groq tem limite de taxa: 1 nova tentativa após uma pausa.
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 4000));
      res = await call();
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Falha na transcrição (${res.status}). ${body.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { text?: string };
    return { ok: true, text: (data.text || "").trim() };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
