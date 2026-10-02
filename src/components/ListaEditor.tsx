"use client";

import { useState } from "react";
import { CORES_LISTA, CORES_ORDEM, MAX_OPCOES, MAX_TAM_OPCAO, OPCOES_SIM_NAO, sanitizarLista, type ColunaExtra, type CorLista, type OpcaoLista } from "@/lib/coluna-lista";

// Editor (só ADMIN) do tipo da coluna: Texto ou Lista suspensa, com opções, cores e
// valor padrão. Devolve só a parte "tipo/opcoes/padrao" — quem chama grava a coluna.
export default function ListaEditor({
  titulo,
  inicial,
  onSalvar,
  onFechar,
}: {
  titulo: string;
  inicial: ColunaExtra;
  onSalvar: (extra: ColunaExtra) => void;
  onFechar: () => void;
}) {
  const [lista, setLista] = useState(inicial.tipo === "lista");
  const [opcoes, setOpcoes] = useState<OpcaoLista[]>(inicial.opcoes?.length ? inicial.opcoes : []);
  const [padrao, setPadrao] = useState(inicial.padrao ?? "");
  const [corAberta, setCorAberta] = useState<number | null>(null);

  const nomes = opcoes.map((o) => o.valor.trim()).filter(Boolean);
  const repetidas = new Set(nomes.map((n) => n.toLowerCase())).size !== nomes.length;
  const invalido = lista && (nomes.length === 0 || repetidas);

  function atualizar(i: number, patch: Partial<OpcaoLista>) {
    setOpcoes((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }
  function mover(i: number, d: -1 | 1) {
    setOpcoes((prev) => {
      const j = i + d;
      if (j < 0 || j >= prev.length) return prev;
      const n = [...prev];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }
  function salvar() {
    if (!lista) return onSalvar({}); // volta para texto (os valores já preenchidos ficam)
    // Mesma normalização do servidor, para o que a tela mostra ser o que será gravado.
    onSalvar(sanitizarLista({ tipo: "lista", opcoes, padrao }));
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div role="dialog" aria-modal="true" className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">Tipo da coluna</h2>
          <p className="mt-0.5 truncate text-sm text-slate-500">{titulo}</p>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
            {([[false, "Texto"], [true, "Lista suspensa"]] as const).map(([v, t]) => (
              <button key={t} type="button" onClick={() => setLista(v)} className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${lista === v ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{t}</button>
            ))}
          </div>

          {!lista ? (
            <p className="text-sm text-slate-500">Texto livre: cada célula aceita qualquer valor. Os valores já preenchidos não são apagados ao trocar o tipo.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Opções ({opcoes.length}/{MAX_OPCOES})</span>
                <button type="button" onClick={() => { setOpcoes(OPCOES_SIM_NAO.map((o) => ({ ...o }))); setPadrao(""); }} className="text-xs font-medium text-indigo-600 hover:underline">Usar Sim / Não</button>
              </div>
              <ul className="space-y-2">
                {opcoes.map((o, i) => (
                  <li key={i} className="relative flex items-center gap-2">
                    <button type="button" aria-label="Escolher cor" onClick={() => setCorAberta(corAberta === i ? null : i)} className={`h-7 w-7 shrink-0 rounded-full ring-2 ring-white ${CORES_LISTA[o.cor].dot} shadow`} title={CORES_LISTA[o.cor].nome} />
                    <input
                      value={o.valor}
                      maxLength={MAX_TAM_OPCAO}
                      onChange={(e) => atualizar(i, { valor: e.target.value })}
                      placeholder="Nome da opção"
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-500"
                    />
                    <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline ${CORES_LISTA[o.cor].chip}`}>{o.valor.trim() || "…"}</span>
                    <button type="button" aria-label="Subir" onClick={() => mover(i, -1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">▲</button>
                    <button type="button" aria-label="Descer" onClick={() => mover(i, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">▼</button>
                    <button type="button" aria-label="Remover opção" onClick={() => { setOpcoes((p) => p.filter((_, idx) => idx !== i)); if (padrao === o.valor) setPadrao(""); }} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500">✕</button>
                    {corAberta === i && (
                      <div className="absolute left-0 top-9 z-10 flex gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                        {CORES_ORDEM.map((c: CorLista) => (
                          <button key={c} type="button" title={CORES_LISTA[c].nome} aria-label={CORES_LISTA[c].nome} onClick={() => { atualizar(i, { cor: c }); setCorAberta(null); }} className={`h-6 w-6 rounded-full ${CORES_LISTA[c].dot} ${o.cor === c ? "ring-2 ring-slate-800 ring-offset-1" : ""}`} />
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <button type="button" disabled={opcoes.length >= MAX_OPCOES} onClick={() => setOpcoes((p) => [...p, { valor: "", cor: CORES_ORDEM[p.length % CORES_ORDEM.length] }])} className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50">+ Adicionar opção</button>
              {repetidas && <p className="text-xs text-red-600">Há opções com o mesmo nome.</p>}

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Valor padrão (linhas novas)</span>
                <select value={padrao} onChange={(e) => setPadrao(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500">
                  <option value="">Nenhum — a célula começa vazia</option>
                  {nomes.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="mt-1 block text-[11px] text-slate-400">Vale só para linhas inseridas à mão; não preenche linhas que já existem.</span>
              </label>
              <p className="text-[11px] text-slate-400">Quem preenche só escolhe uma das opções (ou limpa). Valor que não está na lista é recusado. Remover uma opção não apaga o que já foi escolhido: aparece como &quot;fora da lista&quot;.</p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onFechar} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
          <button type="button" disabled={invalido} onClick={salvar} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Salvar</button>
        </div>
      </div>
    </div>
  );
}
