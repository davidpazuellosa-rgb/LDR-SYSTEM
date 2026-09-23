import { auth } from "@/auth";
import { join, publish } from "@/lib/realtime-hub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY = 512 * 1024; // um lote grande de colar/limpar cabe folgado
const EVENTOS = new Set(["edit", "reorder"]);

async function quem() {
  const session = await auth();
  const u = session?.user as { id?: string; name?: string | null; email?: string | null } | undefined;
  if (!u?.id) return null;
  return { id: u.id, nome: u.name || u.email || "Usuário" };
}

// Conexão aberta (SSE): a tela recebe presença + edições dos colegas em tempo real.
export async function GET(req: Request, { params }: { params: Promise<{ baseId: string }> }) {
  const user = await quem();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const { baseId } = await params;

  const enc = new TextEncoder();
  let sair: (() => void) | null = null;
  let batida: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const escrever = (s: string) => controller.enqueue(enc.encode(s));
      sair = join(baseId, user, (event, data) => escrever(`event: ${event}\ndata: ${data}\n\n`));
      // Batida periódica: mantém a conexão viva atrás de proxies e detecta queda.
      batida = setInterval(() => {
        try {
          escrever(`: ping\n\n`);
        } catch {
          /* fechada */
        }
      }, 25_000);
      escrever(`retry: 3000\n\n`);
    },
    cancel() {
      if (batida) clearInterval(batida);
      sair?.();
    },
  });

  req.signal.addEventListener("abort", () => {
    if (batida) clearInterval(batida);
    sair?.();
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// Envio de uma edição/reordenação para os outros que estão na base.
export async function POST(req: Request, { params }: { params: Promise<{ baseId: string }> }) {
  const user = await quem();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const { baseId } = await params;

  const texto = await req.text();
  if (texto.length > MAX_BODY) return new Response("Grande demais", { status: 413 });

  let body: { event?: string; payload?: Record<string, unknown> } = {};
  try {
    body = JSON.parse(texto);
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }
  if (!body.event || !EVENTOS.has(body.event) || !body.payload || typeof body.payload !== "object") {
    return new Response("Evento inválido", { status: 400 });
  }

  // `from` vem da SESSÃO, nunca do cliente — ninguém se passa por outra pessoa.
  publish(baseId, body.event, { ...body.payload, from: user.id });
  return new Response(null, { status: 204 });
}
