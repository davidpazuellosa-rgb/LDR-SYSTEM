"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";
import { useToast } from "@/components/Toast";
import CardMenu from "@/components/CardMenu";
import { pctOf, tier, REGIOES_BRASIL } from "@/lib/completude";
import { useVisao, VisaoToggle, ThSort, proximaOrd, type Ord } from "@/components/ListaUtils";
import IconeMais from "@/components/IconeMais";
import ValidacaoResumo, { type ValidacaoContagem } from "@/components/ValidacaoResumo";

export type RegiaoCard = {
  regiao: string;
  total: number;
  done: number;
  baseId: string | null;
  titulo?: string;
  hasPlanilha: boolean;
  validacao?: ValidacaoContagem;
};

function DatabaseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  );
}

function PlanilhaBadge({ has }: { has: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
        has ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      {has ? "Planilha importada" : "Sem planilha"}
    </span>
  );
}

export type PlanilhaAvulsa = { id: string; nome: string; total: number; done: number; validacao?: ValidacaoContagem };

export default function RegioesGrid({ orgao, cards, voltar, avulsas = [] }: { orgao: string; cards: RegiaoCard[]; voltar?: React.ReactNode; avulsas?: PlanilhaAvulsa[] }) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [menuNova, setMenuNova] = useState(false);
  const [avulsaOpen, setAvulsaOpen] = useState(false);
  const [avulsaNome, setAvulsaNome] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuNova) return;
    const fora = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuNova(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [menuNova]);
  const [regiao, setRegiao] = useState<string>(REGIOES_BRASIL[0]);
  const [visao, escolher] = useVisao();
  const [ord, setOrd] = useState<Ord>(null);

  const RANK: Record<string, number> = { "Não iniciado": 0, "Em andamento": 1, "Quase lá": 2, "Concluído": 3 };
  const linhas = useMemo(() => {
    if (!ord) return cards;
    const valor = (c: RegiaoCard): string | number => {
      const v = c.validacao ? c.validacao.sim + c.validacao.nao + c.validacao.aValidar : 0;
      return ord.k === "nome" ? (c.titulo || c.regiao).toLowerCase()
        : ord.k === "planilha" ? (c.baseId ? 1 : 0)
        : ord.k === "contatos" ? c.total
        : ord.k === "pct" ? pctOf(c.done, c.total)
        : ord.k === "situacao" ? RANK[c.total > 0 ? tier(pctOf(c.done, c.total)).label : "Não iniciado"] ?? 0
        : v > 0 ? (c.validacao!.sim + c.validacao!.nao) / v : -1;
    };
    return [...cards].sort((a, b) => {
      const x = valor(a), y = valor(b);
      return (x < y ? -1 : x > y ? 1 : a.regiao.localeCompare(b.regiao)) * ord.dir;
    });
  }, [cards, ord]);

  // Cria a base "{orgao} - {regiao}" e abre a planilha. Usado pelo card "Sem planilha"
  // e pelo formulário "Nova região".
  async function criarRegiao(nomeRegiao: string) {
    setCreating(nomeRegiao);
    const loadingId = toast.loading("Criando planilha...", `${orgao} · ${nomeRegiao}`);
    try {
      const res = await fetch(apiPath("/api/bases"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${orgao} - ${nomeRegiao}` }),
      });
      const data = await res.json().catch(() => ({}));
      toast.dismiss(loadingId);
      if (!res.ok) {
        toast.error("Não foi possível criar a planilha.", data.error || `Erro ${res.status}.`);
        return;
      }
      toast.success("Planilha criada.", `${orgao} · ${nomeRegiao}`);
      router.push(`/bases/${data.id}?regiao=${encodeURIComponent(nomeRegiao)}`);
    } catch (error) {
      toast.dismiss(loadingId);
      toast.error("Não foi possível criar a planilha.", (error as Error).message);
    } finally {
      setCreating(null);
    }
  }

  async function criarAvulsa() {
    const nome = avulsaNome.trim();
    if (!nome) { toast.error("Informe o nome da planilha."); return; }
    setCreating("__avulsa__");
    const loadingId = toast.loading("Criando planilha...", `${orgao} · ${nome}`);
    try {
      const res = await fetch(apiPath("/api/bases"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${orgao} - ${nome}`, avulsa: true }),
      });
      const data = await res.json().catch(() => ({}));
      toast.dismiss(loadingId);
      if (!res.ok) { toast.error("Não foi possível criar a planilha.", data.error || `Erro ${res.status}.`); return; }
      toast.success("Planilha criada.", `${orgao} · ${nome}`);
      setAvulsaOpen(false);
      setAvulsaNome("");
      router.push(`/bases/${data.id}`);
    } catch (error) {
      toast.dismiss(loadingId);
      toast.error("Não foi possível criar a planilha.", (error as Error).message);
    } finally {
      setCreating(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>{voltar}</div>
        <div className="flex items-center gap-2">
          <VisaoToggle visao={visao} onChange={escolher} />
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuNova((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuNova}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <IconeMais />
              Nova planilha
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {menuNova && (
              <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                <button role="menuitem" onClick={() => { setMenuNova(false); setAvulsaOpen(true); }} className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Planilha avulsa</button>
                <button role="menuitem" onClick={() => { setMenuNova(false); setOpen(true); }} className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Nova região</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {visao === "lista" ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <ThSort k="nome" ord={ord} onSort={(k) => setOrd(proximaOrd(ord, k))} className="!px-5">Região</ThSort>
                <ThSort k="contatos" ord={ord} onSort={(k) => setOrd(proximaOrd(ord, k))} direita>Contatos</ThSort>
                <ThSort k="pct" ord={ord} onSort={(k) => setOrd(proximaOrd(ord, k))}>Preenchimento</ThSort>
                <ThSort k="valid" ord={ord} onSort={(k) => setOrd(proximaOrd(ord, k))}>Validados</ThSort>
                <th className="w-40 px-3 py-3" />
                <th className="sticky right-0 w-14 bg-slate-50 px-1 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {linhas.map((c) => {
                const pct = pctOf(c.done, c.total);
                const t = tier(pct);
                const v = c.validacao;
                const totV = v ? v.sim + v.nao + v.aValidar : 0;
                const href = c.baseId ? `/bases/${c.baseId}?regiao=${encodeURIComponent(c.regiao)}` : null;
                return (
                  <tr key={c.regiao} onClick={href ? () => router.push(href) : undefined} className={`hover:bg-slate-50/70 ${href ? "cursor-pointer" : ""}`}>
                    <td className="px-5 py-3">
                      {href ? (
                        <Link href={href} className="font-semibold text-slate-800 hover:text-indigo-600">{c.titulo || c.regiao}</Link>
                      ) : (
                        <span className="font-semibold text-slate-800">{c.titulo || c.regiao}</span>
                      )}
                      <div className="text-xs text-slate-400">{orgao}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{c.total.toLocaleString("pt-BR")}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {c.total > 0 ? (
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(2, pct)}%` }} />
                          </div>
                          <span className={`w-10 text-right font-semibold tabular-nums ${t.text}`}>{pct}%</span>
                          <span className="text-xs tabular-nums text-slate-400">{c.done.toLocaleString("pt-BR")} de {c.total.toLocaleString("pt-BR")}</span>
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs">
                      {v && totV > 0 ? (
                        <span className="tabular-nums text-slate-500">
                          <strong className="text-slate-700">{Math.round(((v.sim + v.nao) / totV) * 100)}%</strong>{" "}
                          · <span className="text-emerald-700">{v.sim.toLocaleString("pt-BR")} Sim</span> · <span className="text-red-600">{v.nao.toLocaleString("pt-BR")} Não</span> · {v.aValidar.toLocaleString("pt-BR")} a validar
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {!href && (
                        <button onClick={() => criarRegiao(c.regiao)} disabled={creating === c.regiao} className="text-sm font-medium text-indigo-600 hover:underline disabled:opacity-60">
                          {creating === c.regiao ? "Criando..." : "Criar planilha"}
                        </button>
                      )}
                    </td>
                    <td className="sticky right-0 bg-white px-1 py-3" onClick={(e) => e.stopPropagation()}>
                      {c.baseId && <CardMenu kind="base" nome={c.regiao} baseId={c.baseId} titulo={c.titulo} contatos={c.total} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => {
          const pct = pctOf(c.done, c.total);
          const t = tier(pct);
          const inner = (
            <>
              <div className={`flex items-start justify-between gap-3 ${c.baseId ? "pr-8" : ""}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                    <DatabaseIcon />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-800">{c.titulo || c.regiao}</h3>
                    <p className="truncate text-xs text-slate-400">{orgao}</p>
                  </div>
                </div>
                <PlanilhaBadge has={c.hasPlanilha} />
              </div>

              {c.total > 0 ? (
                <div className="mt-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-2xl font-bold ${t.text}`}>{pct}%</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${t.chip}`}>{t.label}</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(2, pct)}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {c.done.toLocaleString("pt-BR")} de {c.total.toLocaleString("pt-BR")} contatos preenchidos
                  </p>
                  {c.validacao && <ValidacaoResumo v={c.validacao} />}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-xs text-slate-400">
                  Nenhuma planilha importada nesta região ainda.
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm text-slate-500">
                  <strong className="font-semibold text-slate-800">{c.total.toLocaleString("pt-BR")}</strong>{" "}
                  {c.total === 1 ? "contato" : "contatos"}
                </span>
                <span className={`flex items-center gap-1 text-sm font-medium text-indigo-600 transition-all group-hover:gap-2 ${c.baseId ? "hidden" : ""}`}>
                  {creating === c.regiao ? "Criando..." : "Criar planilha"}
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
            </>
          );

          const cardClass = `group flex flex-col rounded-2xl border border-l-4 border-slate-200 ${t.borderL} bg-white p-5 text-left shadow-sm transition hover:shadow-md`;

          return c.baseId ? (
            <div key={c.regiao} className="relative">
              <CardMenu kind="base" nome={c.regiao} baseId={c.baseId} titulo={c.titulo} contatos={c.total} />
              <Link href={`/bases/${c.baseId}?regiao=${encodeURIComponent(c.regiao)}`} className={`${cardClass} h-full`}>
                {inner}
              </Link>
            </div>
          ) : (
            <button
              key={c.regiao}
              onClick={() => criarRegiao(c.regiao)}
              disabled={creating === c.regiao}
              className={`${cardClass} disabled:opacity-70`}
            >
              {inner}
            </button>
          );
        })}
      </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-slate-800">Nova região</h2>
            <p className="mb-4 text-sm text-slate-500">
              Cria uma planilha para uma região de <strong className="text-slate-700">{orgao}</strong>.
            </p>
            <label className="block text-sm font-medium text-slate-700">
              Região
              <select
                value={regiao}
                onChange={(event) => setRegiao(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              >
                {REGIOES_BRASIL.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                disabled={!!creating}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  criarRegiao(regiao);
                }}
                disabled={!!creating}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                Criar região
              </button>
            </div>
          </div>
        </div>
      )}

      {avulsas.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-slate-700">Planilhas avulsas</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {avulsas.map((a) => {
              const pct = pctOf(a.done, a.total);
              const t = tier(pct);
              return (
                <div key={a.id} className="relative">
                  <CardMenu kind="base" nome={a.nome} baseId={a.id} contatos={a.total} />
                  <Link href={`/bases/${a.id}`} className={`group flex h-full flex-col rounded-2xl border border-l-4 border-slate-200 ${t.borderL} bg-white p-5 text-left shadow-sm transition hover:shadow-md`}>
                    <div className="flex min-w-0 items-center gap-3 pr-8">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><DatabaseIcon /></span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-800">{a.nome}</h3>
                        <p className="truncate text-xs text-slate-400">{orgao}</p>
                      </div>
                    </div>
                    {a.total > 0 && (
                      <div className="mt-4">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={`text-2xl font-bold ${t.text}`}>{pct}%</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${t.chip}`}>{t.label}</span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(2, pct)}%` }} />
                        </div>
                        <p className="mt-1.5 text-xs text-slate-400">{a.done.toLocaleString("pt-BR")} de {a.total.toLocaleString("pt-BR")} contatos preenchidos</p>
                        {a.validacao && <ValidacaoResumo v={a.validacao} />}
                      </div>
                    )}
                    <div className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-500">
                      <strong className="font-semibold text-slate-800">{a.total.toLocaleString("pt-BR")}</strong> {a.total === 1 ? "contato" : "contatos"}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {avulsaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-slate-800">Planilha avulsa</h2>
            <p className="mb-4 text-sm text-slate-500">
              Cria uma planilha dentro de <strong className="text-slate-700">{orgao}</strong>, sem região.
            </p>
            <label className="block text-sm font-medium text-slate-700">
              Nome da planilha
              <input
                value={avulsaNome}
                onChange={(e) => setAvulsaNome(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") criarAvulsa(); }}
                maxLength={80}
                autoFocus
                placeholder="Ex.: Eventos 2026"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setAvulsaOpen(false); setAvulsaNome(""); }} disabled={!!creating} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
              <button onClick={criarAvulsa} disabled={!!creating || !avulsaNome.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Criar planilha</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
