"use client";

import { useEffect, useState } from "react";
import { apiPath } from "@/lib/path";
import { ufSigla } from "@/lib/uf";
import { useToast } from "@/components/Toast";

type Item = {
  eventoId: string;
  cidade: string | null;
  estado: string | null;
  campo: string;
  de: string | null;
  para: string | null;
  em: string | null;
  por: string | null;
};

const campoLabel = (c: string) => (c === "telefonePrefeitura" ? "Telefone" : c);
const fmt = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

export default function HistoricoModal({
  baseId,
  onClose,
  onReverted,
}: {
  baseId: string;
  onClose: () => void;
  onReverted?: (contactId: string, data: Record<string, string | null>) => void;
}) {
  const toast = useToast();
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reverting, setReverting] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(apiPath(`/api/bases/${baseId}/historico`));
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) setError(data.error || "Não foi possível carregar o histórico.");
        else setItens(data.itens || []);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [baseId]);

  async function reverter(eventoId: string) {
    setReverting(eventoId);
    try {
      const res = await fetch(apiPath(`/api/bases/${baseId}/desfazer`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Não foi possível reverter.", data.error || `Erro ${res.status}.`);
        return;
      }
      toast.success("Alteração revertida.", "O valor anterior foi restaurado.");
      setItens((prev) => prev.filter((it) => it.eventoId !== eventoId));
      if (data.restored && onReverted) onReverted(data.restored.contactId, data.restored.data);
    } catch (e) {
      toast.error("Não foi possível reverter.", (e as Error).message);
    } finally {
      setReverting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Histórico de alterações</h2>
            <p className="text-sm text-slate-500">Últimas 7 mudanças desta planilha — dá pra reverter cada uma.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fechar">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Carregando…</p>
          ) : error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          ) : itens.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Nenhuma alteração registrada nesta planilha ainda.</p>
          ) : (
            <ol className="space-y-3">
              {itens.map((it) => (
                <li key={it.eventoId} className="flex items-start gap-3 border-b border-slate-50 pb-3 last:border-0">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-300" />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="text-slate-700">
                      <span className="font-medium">{[it.cidade, ufSigla(it.estado)].filter(Boolean).join(" / ") || "Contato"}</span>
                      <span className="text-slate-400"> · {campoLabel(it.campo)}</span>
                    </div>
                    <div className="truncate text-slate-500">
                      {it.de || "—"} <span className="text-slate-300">→</span> <span className="text-slate-700">{it.para || "—"}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {fmt(it.em)}
                      {it.por ? ` · ${it.por}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => reverter(it.eventoId)}
                    disabled={reverting === it.eventoId}
                    className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                  >
                    {reverting === it.eventoId ? "Revertendo…" : "Reverter"}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
