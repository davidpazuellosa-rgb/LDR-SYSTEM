// Estilos compartilhados dos filtros. Ficam em um módulo SEM "use client" para poderem ser
// usados tanto por componentes de servidor quanto de cliente (um arquivo "use client" só
// exporta componentes: funções/constantes dele não podem ser chamadas no servidor).
export const SEGMENTADO = "inline-flex rounded-lg border border-slate-200 bg-white p-0.5";
export const segBtn = (on: boolean) =>
  `rounded-md px-2.5 py-1.5 text-sm font-medium transition ${on ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800"}`;
