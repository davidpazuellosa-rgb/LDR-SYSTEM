"use client";

import { useRef, useState } from "react";
import { CORES_LISTA, CORES_ORDEM, MAX_OPCOES, MAX_TAM_OPCAO, sanitizarLista, type ColunaExtra, type CorLista, type OpcaoLista } from "@/lib/coluna-lista";

// Modelos prontos: um clique já monta a lista com as cores.
const MODELOS: { nome: string; opcoes: OpcaoLista[] }[] = [
  { nome: "Sim / Não", opcoes: [{ valor: "Sim", cor: "verde" }, { valor: "Não", cor: "vermelho" }] },
  { nome: "Sim / Não / Pendente", opcoes: [{ valor: "Sim", cor: "verde" }, { valor: "Não", cor: "vermelho" }, { valor: "Pendente", cor: "ambar" }] },
  { nome: "Validação", opcoes: [{ valor: "Validado", cor: "verde" }, { valor: "Em análise", cor: "ambar" }, { valor: "Reprovado", cor: "vermelho" }] },
  { nome: "Andamento", opcoes: [{ valor: "A fazer", cor: "cinza" }, { valor: "Em andamento", cor: "azul" }, { valor: "Concluído", cor: "verde" }] },
  { nome: "Prioridade", opcoes: [{ valor: "Baixa", cor: "azul" }, { valor: "Média", cor: "ambar" }, { valor: "Alta", cor: "vermelho" }] },
];

// Editor (só ADMIN) do tipo da coluna: Texto ou Lista suspensa. Devolve só a parte
// "tipo/opcoes/padrao" — quem chama grava a coluna.
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
  const [opcoes, setOpcoes] = useState<OpcaoLista[]>(inicial.opcoes ?? []);
  const [padrao, setPadrao] = useState(inicial.padrao ?? "");
  const [novo, setNovo] = useState("");
  const [corAberta, setCorAberta] = useState<number | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  const nomes = opcoes.map((o) => o.valor.trim());
  const vazias = nomes.some((n) => !n);
  const repetidas = new Set(nomes.filter(Boolean).map((n) => n.toLowerCase())).size !== nomes.filter(Boolean).length;
  const semOpcoes = opcoes.length === 0;
  const problema = !lista ? null : semOpcoes ? "Adicione pelo menos uma opção." : vazias ? "Preencha o nome de todas as opções." : repetidas ? "Há opções com o mesmo nome." : null;

  // Próxima cor que ainda não foi usada (assim cada opção nasce com cor diferente).
  const proximaCor = (): CorLista => CORES_ORDEM.find((c) => !opcoes.some((o) => o.cor === c)) ?? CORES_ORDEM[opcoes.length % CORES_ORDEM.length];

  function adicionar() {
    const v = novo.trim().slice(0, MAX_TAM_OPCAO);
    if (!v || opcoes.length >= MAX_OPCOES) return;
    if (nomes.some((n) => n.toLowerCase() === v.toLowerCase())) return;
    setOpcoes((p) => [...p, { valor: v, cor: proximaCor() }]);
    setNovo("");
    campo.current?.focus();
  }
  const atualizar = (i: number, patch: Partial<OpcaoLista>) => setOpcoes((p) => p.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  function mover(i: number, d: -1 | 1) {
    setOpcoes((p) => {
      const j = i + d;
      if (j < 0 || j >= p.length) return p;
      const n = [...p];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }
  function remover(i: number) {
    const era = opcoes[i].valor;
    setOpcoes((p) => p.filter((_, idx) => idx !== i));
    if (padrao === era) setPadrao("");
    setCorAberta(null);
  }
  function usarModelo(m: (typeof MODELOS)[number]) {
    setOpcoes(m.opcoes.map((o) => ({ ...o })));
    setPadrao("");
    setCorAberta(null);
  }
  function salvar() {
    if (!lista) return onSalvar({}); // volta para texto (os valores já preenchidos ficam)
    onSalvar(sanitizarLista({ tipo: "lista", opcoes, padrao })); // mesma regra do servidor
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div role="dialog" aria-modal="true" className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-7 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-800">Configurar coluna</h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              Coluna: <span className="font-medium text-slate-700">{titulo}</span>
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-7 py-5">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-3">
            {([
              [false, "Texto livre", "Cada célula aceita qualquer texto."],
              [true, "Lista suspensa", "A pessoa escolhe uma opção da lista."],
            ] as const).map(([v, t, d]) => (
              <button
                key={t}
                type="button"
                onClick={() => setLista(v)}
                className={`rounded-xl border-2 p-4 text-left transition ${lista === v ? "border-indigo-600 bg-indigo-50/60" : "border-slate-200 hover:border-slate-300"}`}
              >
                <div className={`text-sm font-semibold ${lista === v ? "text-indigo-700" : "text-slate-700"}`}>{t}</div>
                <div className="mt-0.5 text-xs text-slate-500">{d}</div>
              </button>
            ))}
          </div>

          {!lista ? (
            <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Os valores já preenchidos na coluna não são apagados ao trocar o tipo.
            </p>
          ) : (
            <>
              {/* 1. Modelos */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">1 · Comece por um modelo <span className="font-normal normal-case text-slate-400">(ou crie as suas abaixo)</span></h3>
                <div className="flex flex-wrap gap-2">
                  {MODELOS.map((m) => (
                    <button key={m.nome} type="button" onClick={() => usarModelo(m)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/50">
                      <span className="flex -space-x-1">
                        {m.opcoes.map((o) => <span key={o.valor} className={`h-3.5 w-3.5 rounded-full ring-2 ring-white ${CORES_LISTA[o.cor].dot}`} />)}
                      </span>
                      {m.nome}
                    </button>
                  ))}
                </div>
              </section>

              {/* 2. Opções */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">2 · Opções <span className="font-normal normal-case text-slate-400">({opcoes.length} de {MAX_OPCOES})</span></h3>
                <div className="flex gap-2">
                  <input
                    ref={campo}
                    value={novo}
                    maxLength={MAX_TAM_OPCAO}
                    onChange={(e) => setNovo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }}
                    placeholder="Digite uma opção e aperte Enter (ex.: Aprovado)"
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500"
                    autoFocus
                  />
                  <button type="button" onClick={adicionar} disabled={!novo.trim() || opcoes.length >= MAX_OPCOES} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">Adicionar</button>
                </div>

                {semOpcoes ? (
                  <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">Nenhuma opção ainda. Escolha um modelo acima ou digite a primeira opção.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {opcoes.map((o, i) => (
                      <li key={i} className="rounded-xl border border-slate-200 bg-white">
                        <div className="flex items-center gap-2 p-2">
                          <button type="button" onClick={() => setCorAberta(corAberta === i ? null : i)} title="Trocar a cor" className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium ${CORES_LISTA[o.cor].chip}`}>
                            <span className={`h-3 w-3 rounded-full ${CORES_LISTA[o.cor].dot}`} /> cor
                          </button>
                          <input
                            value={o.valor}
                            maxLength={MAX_TAM_OPCAO}
                            onChange={(e) => atualizar(i, { valor: e.target.value })}
                            aria-label="Nome da opção"
                            className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1.5 text-sm font-medium text-slate-800 outline-none hover:border-slate-200 focus:border-indigo-500"
                          />
                          <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30">↑</button>
                          <button type="button" aria-label="Descer" disabled={i === opcoes.length - 1} onClick={() => mover(i, 1)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30">↓</button>
                          <button type="button" aria-label="Remover opção" onClick={() => remover(i)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6 7v12.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                        </div>
                        {corAberta === i && (
                          <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-2.5">
                            {CORES_ORDEM.map((c) => (
                              <button key={c} type="button" onClick={() => { atualizar(i, { cor: c }); setCorAberta(null); }} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${CORES_LISTA[c].chip} ${o.cor === c ? "ring-2 ring-slate-700 ring-offset-1" : ""}`}>
                                <span className={`h-2.5 w-2.5 rounded-full ${CORES_LISTA[c].dot}`} />{CORES_LISTA[c].nome}
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* 3. Padrão */}
              {!semOpcoes && (
                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">3 · Valor inicial <span className="font-normal normal-case text-slate-400">(opcional)</span></h3>
                  <p className="mb-2 text-xs text-slate-400">Linhas novas inseridas à mão já nascem com este valor. As linhas que já existem não mudam.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setPadrao("")} className={`rounded-full border px-3 py-1 text-sm ${padrao === "" ? "border-indigo-600 bg-indigo-50 font-medium text-indigo-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>Vazio</button>
                    {opcoes.filter((o) => o.valor.trim()).map((o) => (
                      <button key={o.valor} type="button" onClick={() => setPadrao(o.valor)} className={`rounded-full border-2 px-1 py-0.5 ${padrao === o.valor ? "border-indigo-600" : "border-transparent"}`}>
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${CORES_LISTA[o.cor].chip}`}>{o.valor}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Prévia */}
              {!semOpcoes && (
                <section className="rounded-xl bg-slate-50 px-4 py-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Como vai aparecer na planilha</h3>
                  <div className="flex flex-wrap gap-2">
                    {opcoes.filter((o) => o.valor.trim()).map((o) => (
                      <span key={o.valor} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CORES_LISTA[o.cor].chip}`}>{o.valor}</span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">Quem preenche só escolhe uma opção (ou deixa vazio). Remover uma opção depois não apaga o que já foi escolhido.</p>
                </section>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-7 py-4">
          <span className="text-xs text-red-500">{problema}</span>
          <div className="flex gap-3">
            <button type="button" onClick={onFechar} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" disabled={!!problema} onClick={salvar} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Salvar coluna</button>
          </div>
        </div>
      </div>
    </div>
  );
}
