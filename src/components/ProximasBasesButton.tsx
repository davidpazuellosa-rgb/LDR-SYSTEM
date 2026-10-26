"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import IconeMais from "@/components/IconeMais";
import type { ItemEspera } from "@/lib/espera";

// "Próximas bases": lista de espera das bases que ainda vão entrar. Dá para adicionar um nome,
// remover, ou criar a base (vira um órgão com as 5 regiões e sai da lista).
export default function ProximasBasesButton({ inicial }: { inicial: ItemEspera[] }) {
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [itens, setItens] = useState(inicial);
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function chamar(method: "POST" | "DELETE", body: unknown, id: string) {
    setBusy(id);
    try {
      const res = await fetch(apiPath("/api/bases/espera"), { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error("Não foi possível concluir.", data.error || `Erro ${res.status}.`); return null; }
      if (data.itens) setItens(data.itens);
      return data;
    } catch (e) {
      toast.error("Não foi possível concluir.", (e as Error).message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function adicionar() {
    const n = nome.trim();
    if (!n) return;
    if (await chamar("POST", { nome: n }, "novo")) setNome("");
  }

  async function criar(item: ItemEspera) {
    if (!(await dialog.confirm({ title: `Criar a base "${item.nome}"?`, message: "Cria o órgão com as 5 regiões do Brasil e tira o nome da lista de espera.", confirmLabel: "Criar base" }))) return;
    const data = await chamar("DELETE", { id: item.id, criar: true }, item.id);
    if (data) {
      toast.success("Base criada.", `${item.nome} · ${data.criadas} região(ões).`);
      setOpen(false);
      router.push(`/bases?tipo=${encodeURIComponent(item.nome)}`);
      router.refresh();
    }
  }

  async function remover(item: ItemEspera) {
    if (!(await dialog.confirm({ title: `Tirar "${item.nome}" da lista de espera?`, confirmLabel: "Tirar", danger: true }))) return;
    await chamar("DELETE", { id: item.id }, item.id);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        Próximas bases{itens.length > 0 ? ` (${itens.length})` : ""}
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onMouseDown={() => setOpen(false)}>
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Próximas bases</h2>
                <p className="text-sm text-slate-500">Lista de espera das bases que ainda vão entrar.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }}
                maxLength={60}
                autoFocus
                placeholder="Nome da base que vai entrar"
                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500"
              />
              <button type="button" onClick={adicionar} disabled={!nome.trim() || busy === "novo"} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                <IconeMais />
                Adicionar
              </button>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              {itens.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Nenhuma base na lista de espera.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {itens.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="min-w-0 truncate text-sm font-medium text-slate-800">{i.nome}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <button type="button" onClick={() => criar(i)} disabled={busy === i.id} className="h-8 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                          Criar base
                        </button>
                        <button type="button" onClick={() => remover(i)} disabled={busy === i.id} aria-label={`Tirar ${i.nome} da lista`} title="Tirar da lista" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
