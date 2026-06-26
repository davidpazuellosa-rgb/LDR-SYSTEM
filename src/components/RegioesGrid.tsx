"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";
import { useToast } from "@/components/Toast";
import { pctOf, tier, REGIOES_BRASIL } from "@/lib/completude";

export type RegiaoCard = {
  regiao: string;
  total: number;
  done: number;
  baseId: string | null;
  hasPlanilha: boolean;
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

export default function RegioesGrid({ orgao, cards }: { orgao: string; cards: RegiaoCard[] }) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [regiao, setRegiao] = useState<string>(REGIOES_BRASIL[0]);

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

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {cards.length} {cards.length === 1 ? "região" : "regiões"}
        </p>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Nova região
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => {
          const pct = pctOf(c.done, c.total);
          const t = tier(pct);
          const inner = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                    <DatabaseIcon />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-800">{c.regiao}</h3>
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
                    {c.done.toLocaleString("pt-BR")} de {c.total.toLocaleString("pt-BR")} prefeituras preenchidas
                  </p>
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
                <span className="flex items-center gap-1 text-sm font-medium text-indigo-600 transition-all group-hover:gap-2">
                  {c.baseId ? "Abrir planilha" : creating === c.regiao ? "Criando..." : "Criar planilha"}
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
            </>
          );

          const cardClass = `group flex flex-col rounded-2xl border border-l-4 border-slate-200 ${t.borderL} bg-white p-5 text-left shadow-sm transition hover:shadow-md`;

          return c.baseId ? (
            <Link key={c.regiao} href={`/bases/${c.baseId}?regiao=${encodeURIComponent(c.regiao)}`} className={cardClass}>
              {inner}
            </Link>
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
    </>
  );
}
