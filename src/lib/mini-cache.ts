// Cache CURTO em memória (por processo) para não repetir, a cada navegação, consultas
// que quase nunca mudam de um clique pro outro (cargo do usuário, contadores da
// sidebar). Não é cache de verdade — cada valor expira sozinho em poucos segundos, e
// uma mudança real aparece quase na hora (ou na hora, se `invalidar` for chamado).
//
// MESMO LIMITE CONSCIENTE do realtime-hub (src/lib/realtime-hub.ts): vive na memória
// de UM processo Node — é o container do VPS. Em ambiente serverless (Vercel, várias
// instâncias) isso só reduziria hits dentro da mesma instância, sem quebrar nada (pior
// caso: cache miss, cai na consulta normal).
type Entry<T> = { value: T; expira: number };
const g = globalThis as unknown as { __ldrMiniCache?: Map<string, Entry<unknown>> };
const cache: Map<string, Entry<unknown>> = (g.__ldrMiniCache ??= new Map());

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  const agora = Date.now();
  if (hit && hit.expira > agora) return hit.value as T;
  const value = await fn();
  cache.set(key, { value, expira: agora + ttlMs });
  return value;
}

// Limpa uma chave (ou tudo, com prefixo vazio) — usado quando uma ação muda algo que
// o cache guarda (ex.: trocar o cargo de alguém), pra não esperar a expiração natural.
export function invalidarCache(prefix: string) {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}
