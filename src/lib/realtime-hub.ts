// Tempo real da planilha SEM Supabase: um "hub" em memória que liga quem está com a
// mesma base aberta. Cada aba do navegador mantém uma conexão SSE
// (/api/realtime/[baseId]); quando alguém edita, o servidor repassa para os outros.
//
// LIMITE CONSCIENTE: o estado vive na memória do processo. Serve para UM processo
// Node (o container do VPS). Em ambiente serverless (Vercel) cada requisição pode cair
// em instâncias diferentes — lá o hook continua usando o Supabase Realtime.

export type Peer = { id: string; nome: string };
export type Sender = (event: string, data: string) => void;
type Client = { user: Peer; send: Sender };

const g = globalThis as unknown as { __ldrHub?: Map<string, Set<Client>> };
const salas: Map<string, Set<Client>> = (g.__ldrHub ??= new Map());

/** Quem está na base — uma entrada por pessoa, mesmo com várias abas abertas. */
export function peersOf(baseId: string): Peer[] {
  const vistos = new Map<string, Peer>();
  for (const c of salas.get(baseId) ?? []) if (!vistos.has(c.user.id)) vistos.set(c.user.id, c.user);
  return [...vistos.values()];
}

/** Manda para TODOS da base (o cliente ignora o que ele próprio enviou). */
export function publish(baseId: string, event: string, payload: unknown) {
  const data = JSON.stringify(payload);
  for (const c of salas.get(baseId) ?? []) {
    try {
      c.send(event, data);
    } catch {
      // conexão morta: a limpeza acontece no abort da requisição
    }
  }
}

function anunciarPresenca(baseId: string) {
  publish(baseId, "presence", peersOf(baseId));
}

/** Entra na base. Devolve a função que sai (chamar quando a conexão fechar). */
export function join(baseId: string, user: Peer, send: Sender): () => void {
  const client: Client = { user, send };
  let sala = salas.get(baseId);
  if (!sala) salas.set(baseId, (sala = new Set()));
  sala.add(client);
  anunciarPresenca(baseId);

  let saiu = false;
  return () => {
    if (saiu) return;
    saiu = true;
    const s = salas.get(baseId);
    if (!s) return;
    s.delete(client);
    if (s.size === 0) salas.delete(baseId);
    else anunciarPresenca(baseId);
  };
}

export function totalConexoes(): number {
  let n = 0;
  for (const s of salas.values()) n += s.size;
  return n;
}
