"use client";

import { useEffect, useState } from "react";
import { apiPath } from "@/lib/path";
import { useToast } from "@/components/Toast";

type BaseOpt = { id: string; name: string; estados: string[] };
type Row = { baseId: string; estado: string; corrigidos: string; preenchidos: string };

export default function MetaModal({ userId, userName, onClose }: { userId: string; userName: string; onClose: () => void }) {
  const toast = useToast();
  const [bases, setBases] = useState<BaseOpt[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(apiPath(`/api/metas/${userId}`));
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) {
          setError(data.error || "Não foi possível carregar as metas.");
        } else {
          setBases(data.bases || []);
          setRows(
            (data.metas || []).map((m: { baseId: string; estado: string; corrigidos: number; preenchidos: number }) => ({
              baseId: m.baseId,
              estado: m.estado,
              corrigidos: String(m.corrigidos ?? 0),
              preenchidos: String(m.preenchidos ?? 0),
            }))
          );
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const estadosDe = (baseId: string) => bases.find((b) => b.id === baseId)?.estados || [];

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    const first = bases[0];
    setRows((prev) => [...prev, { baseId: first?.id || "", estado: "", corrigidos: "", preenchidos: "" }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const loadingId = toast.loading("Salvando metas...", userName);
    try {
      const metas = rows
        .filter((r) => r.baseId && r.estado)
        .map((r) => ({ baseId: r.baseId, estado: r.estado, corrigidos: r.corrigidos, preenchidos: r.preenchidos }));
      const res = await fetch(apiPath(`/api/metas/${userId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metas }),
      });
      const data = await res.json().catch(() => ({}));
      toast.dismiss(loadingId);
      if (res.ok) {
        toast.success("Metas salvas.", `${data.count ?? 0} meta(s) para ${userName}.`);
        onClose();
      } else {
        setError(data.error || "Não foi possível salvar.");
        toast.error("Não foi possível salvar as metas.", data.error || `Erro ${res.status}.`);
      }
    } catch (e) {
      toast.dismiss(loadingId);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Meta de {userName}</h2>
            <p className="mt-0.5 text-sm text-slate-500">Defina a meta semanal por base e por estado.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fechar">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Carregando…</p>
          ) : (
            <>
              <div className="mb-2 grid grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr_auto] gap-2 px-1 text-xs font-medium text-slate-400">
                <div>Base</div>
                <div>Estado</div>
                <div>Corrigidos</div>
                <div>Preenchidos</div>
                <div />
              </div>

              <div className="space-y-2">
                {rows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr_auto] items-center gap-2">
                    <select
                      value={r.baseId}
                      onChange={(e) => update(i, { baseId: e.target.value, estado: "" })}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
                    >
                      <option value="">Selecione…</option>
                      {bases.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <select
                      value={r.estado}
                      onChange={(e) => update(i, { estado: e.target.value })}
                      disabled={!r.baseId}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50"
                    >
                      <option value="">UF…</option>
                      {estadosDe(r.baseId).map((uf) => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={r.corrigidos}
                      onChange={(e) => update(i, { corrigidos: e.target.value })}
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
                    />
                    <input
                      type="number"
                      min={0}
                      value={r.preenchidos}
                      onChange={(e) => update(i, { preenchidos: e.target.value })}
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
                    />
                    <button onClick={() => removeRow(i)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label="Remover linha">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6 7v12.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                ))}
                {rows.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Nenhuma meta definida ainda. Adicione abaixo.</p>}
              </div>

              <button
                onClick={addRow}
                disabled={bases.length === 0}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                Adicionar meta (base + estado)
              </button>

              {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={save} disabled={saving || loading} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving ? "Salvando…" : "Salvar metas"}
          </button>
        </div>
      </div>
    </div>
  );
}
