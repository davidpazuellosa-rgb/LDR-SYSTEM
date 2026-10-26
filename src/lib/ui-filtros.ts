// Estilos compartilhados dos filtros. Ficam em um módulo SEM "use client" para poderem ser
// usados tanto por componentes de servidor quanto de cliente (um arquivo "use client" só
// exporta componentes: funções/constantes dele não podem ser chamadas no servidor).
export const SEGMENTADO = "inline-flex rounded-lg border border-slate-200 bg-white p-0.5";
export const segBtn = (on: boolean) =>
  `rounded-md px-2.5 py-1.5 text-sm font-medium transition ${on ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800"}`;

// Posição de um popup/menu de posição fixa ancorado num botão: abre para baixo; se não couber
// (ex.: botão no rodapé da tela) abre para CIMA; e nunca passa das bordas da janela.
export function posicaoPopup(r: { top: number; bottom: number; left: number; right: number }, largura: number, altura: number, alinharDireita = false): { left: number; top?: number; bottom?: number } {
  const W = typeof window === "undefined" ? 1280 : window.innerWidth;
  const H = typeof window === "undefined" ? 800 : window.innerHeight;
  const m = 8;
  const left = Math.max(m, Math.min(alinharDireita ? r.right - largura : r.left, W - largura - m));
  const abaixo = H - r.bottom - m;
  const acima = r.top - m;
  if (abaixo >= altura || abaixo >= acima) return { left, top: Math.min(r.bottom + 4, Math.max(m, H - altura - m)) };
  return { left, bottom: H - r.top + 4 };
}
