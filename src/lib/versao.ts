// Versão (publicação) do sistema. NEXT_PUBLIC_BUILD_ID é definido no build (next.config.ts) e fica
// embutido tanto no navegador quanto na rota /api/versao. Em desenvolvimento vale "dev".
export const VERSAO_ATUAL = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

// A tela só avisa quando o servidor devolve uma versão válida e DIFERENTE da que ela carregou.
// Resposta vazia/erro/versão igual = nada a fazer (não alarma por falha de rede nem por reinício).
export function precisaAtualizar(local: string, remota: unknown): boolean {
  return typeof remota === "string" && remota.length > 0 && remota !== "dev" && local !== "dev" && remota !== local;
}
