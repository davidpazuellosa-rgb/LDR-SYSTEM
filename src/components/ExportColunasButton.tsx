"use client";

import { useState } from "react";

// Botão que, em vez de baixar direto, abre o popup de escolha de colunas (checklist) e
// só baixa ao confirmar. `href` é a URL do CSV; as colunas escolhidas vão em ?cols=<índices>.
export default function ExportColunasButton({
  href,
  colunas,
  titulo = "Exportar",
  className,
  children,
}: {
  href: string;
  colunas: readonly string[];
  titulo?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());

  function confirmar() {
    const a = document.createElement("a");
    const idx = [...sel].sort((x, y) => x - y).join(",");
    a.href = `${href}${href.includes("?") ? "&" : "?"}cols=${idx}`;
    a.click();
    setOpen(false);
  }

  return (
    <>
      <button type="button" className={className} onClick={() => { setSel(new Set(colunas.map((_, i) => i))); setOpen(true); }}>
        {children}
      </button>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal="true" className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-800">{titulo}</h2>
              <p className="mt-0.5 text-sm text-slate-500">Escolha as colunas do arquivo (CSV).</p>
            </div>
            <div className="flex items-center justify-between px-6 py-2 text-xs">
              <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => setSel(new Set(colunas.map((_, i) => i)))}>Selecionar todas</button>
              <button type="button" className="text-slate-400 hover:text-slate-600" onClick={() => setSel(new Set())}>Limpar</button>
            </div>
            <ul className="flex-1 overflow-y-auto px-3 pb-2">
              {colunas.map((c, i) => (
                <li key={c}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    <input type="checkbox" checked={sel.has(i)} onChange={() => setSel((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; })} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
                    {c}
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
              <span className="text-xs text-slate-400">{sel.size} de {colunas.length} colunas</span>
              <div className="flex gap-3">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button type="button" disabled={sel.size === 0} onClick={confirmar} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Exportar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
