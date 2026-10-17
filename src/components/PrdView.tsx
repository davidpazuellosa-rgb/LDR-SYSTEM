"use client";

import { useMemo, useState } from "react";

type Secao = { id: string; n: number | null; titulo: string; html: string; texto: string; restrito: boolean };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Documentação do sistema com índice lateral e busca. As seções já vêm filtradas pelo servidor
// de acordo com o cargo; aqui só se mostra o que chegou.
export default function PrdView({ titulo, intro, secoes }: { titulo: string; intro: string; secoes: Secao[] }) {
  const [q, setQ] = useState("");
  const [ativa, setAtiva] = useState<string | null>(null);

  const visiveis = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return secoes;
    return secoes.filter((s) => norm(s.titulo).includes(n) || norm(s.texto).includes(n));
  }, [secoes, q]);

  function ir(id: string) {
    setAtiva(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="relative mb-3">
          <svg className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar na documentação…"
            aria-label="Buscar na documentação"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <nav className="max-h-[70vh] space-y-0.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-sm">
          {visiveis.length === 0 && <p className="px-2 py-3 text-xs text-slate-400">Nada encontrado.</p>}
          {visiveis.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => ir(s.id)}
              className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left transition ${ativa === s.id ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {s.n !== null && <span className="w-5 shrink-0 tabular-nums text-slate-400">{s.n}</span>}
              <span className="min-w-0 flex-1">{s.titulo}</span>
              {s.restrito && <span title="Visível só para administradores" className="shrink-0 rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-700">admin</span>}
            </button>
          ))}
        </nav>
      </aside>

      <article className="min-w-0">
        <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-800">{titulo}</h1>
          {intro && <div className="prd-doc mt-3" dangerouslySetInnerHTML={{ __html: intro }} />}
        </header>
        <div className="space-y-6">
          {visiveis.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-800">
                {s.n !== null && <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-indigo-50 px-1.5 text-sm font-bold text-indigo-600">{s.n}</span>}
                {s.titulo}
                {s.restrito && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">só administradores</span>}
              </h2>
              <div className="prd-doc" dangerouslySetInnerHTML={{ __html: s.html }} />
            </section>
          ))}
          {visiveis.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">Nenhuma seção encontrada para “{q}”.</p>}
        </div>
      </article>
    </div>
  );
}
