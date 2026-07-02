"use client";

import { useEffect, useState } from "react";
import { apiPath } from "@/lib/path";
import { useToast } from "@/components/Toast";

type RegiaoOpt = { regiao: string; baseId: string; estados: string[] };
type TipoOpt = { tipo: string; regioes: RegiaoOpt[] };
type FillRow = { tipo: string; regiao: string; estado: string; baseId: string; prazo: string; alvo: string; dataLimite: string };
type CorrRow = { campanha: string; prazo: string; alvo: string; dataLimite: string };

type MetaIn = {
  tipo?: string;
  baseId?: string | null;
  regiao?: string | null;
  estado?: string | null;
  campanha?: string | null;
  prazo?: string;
  alvo?: number;
  dataLimite?: string | null;
};

// Data (ISO) -> yyyy-mm-dd para o <input type="date">.
const dataInput = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "");

const selCls =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50";
const numCls = "w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500";

export default function MetaModal({ userId, userName, onClose }: { userId: string; userName: string; onClose: () => void }) {
  const toast = useToast();
  const [tipos, setTipos] = useState<TipoOpt[]>([]);
  const [campanhas, setCampanhas] = useState<string[]>([]);
  const [fillRows, setFillRows] = useState<FillRow[]>([]);
  const [corrRows, setCorrRows] = useState<CorrRow[]>([]);
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
          const byId: Record<string, { name: string; tipo: string }> = data.basesById || {};
          setTipos(data.tipos || []);
          setCampanhas(data.campanhas || []);
          const metas: MetaIn[] = data.metas || [];
          setFillRows(
            metas
              .filter((m) => (m.tipo || "preenchimento") !== "correcao")
              .map((m) => ({
                tipo: byId[m.baseId || ""]?.tipo || "",
                regiao: m.regiao || "",
                estado: m.estado || "",
                baseId: m.baseId || "",
                prazo: m.prazo === "mensal" ? "mensal" : m.prazo === "diaria" ? "diaria" : "semanal",
                alvo: String(m.alvo ?? 0),
                dataLimite: dataInput(m.dataLimite),
              }))
          );
          setCorrRows(
            metas
              .filter((m) => m.tipo === "correcao")
              .map((m) => ({
                campanha: m.campanha || "",
                prazo: m.prazo === "mensal" ? "mensal" : m.prazo === "diaria" ? "diaria" : "semanal",
                alvo: String(m.alvo ?? 0),
                dataLimite: dataInput(m.dataLimite),
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

  const regioesDe = (tipo: string) => tipos.find((t) => t.tipo === tipo)?.regioes || [];
  const estadosDe = (tipo: string, regiao: string) =>
    regioesDe(tipo).find((r) => r.regiao === regiao)?.estados || [];

  function updFill(i: number, patch: Partial<FillRow>) {
    setFillRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function updCorr(i: number, patch: Partial<CorrRow>) {
    setCorrRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addFill() {
    setFillRows((prev) => [...prev, { tipo: tipos[0]?.tipo || "", regiao: "", estado: "", baseId: "", prazo: "semanal", alvo: "", dataLimite: "" }]);
  }
  function addCorr() {
    setCorrRows((prev) => [...prev, { campanha: campanhas[0] || "", prazo: "semanal", alvo: "", dataLimite: "" }]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const loadingId = toast.loading("Salvando metas...", userName);
    try {
      const metas = [
        ...fillRows
          .filter((r) => r.baseId && r.regiao && r.estado)
          .map((r) => ({ tipo: "preenchimento", baseId: r.baseId, regiao: r.regiao, estado: r.estado, prazo: r.prazo, alvo: r.alvo, dataLimite: r.dataLimite || null })),
        ...corrRows
          .filter((r) => r.campanha)
          .map((r) => ({ tipo: "correcao", campanha: r.campanha, prazo: r.prazo, alvo: r.alvo, dataLimite: r.dataLimite || null })),
      ];
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
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Meta de {userName}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Duas submetas independentes: preenchimento (base → região → estado) e correção (por campanha).
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fechar">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Carregando…</p>
          ) : (
            <>
              {/* ───── Preenchimento ───── */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Preenchimento de contatos</h3>
                <div className="mb-2 grid grid-cols-[1.3fr_1fr_0.6fr_0.8fr_0.6fr_0.9fr_auto] gap-2 px-1 text-xs font-medium text-slate-400">
                  <div>Tipo de órgão</div>
                  <div>Região</div>
                  <div>Estado</div>
                  <div>Prazo</div>
                  <div>Meta</div>
                  <div>Até</div>
                  <div />
                </div>
                <div className="space-y-2">
                  {fillRows.map((r, i) => (
                    <div key={i} className="grid grid-cols-[1.3fr_1fr_0.6fr_0.8fr_0.6fr_0.9fr_auto] items-center gap-2">
                      <select value={r.tipo} onChange={(e) => updFill(i, { tipo: e.target.value, regiao: "", estado: "", baseId: "" })} className={selCls}>
                        <option value="">Selecione…</option>
                        {tipos.map((t) => (
                          <option key={t.tipo} value={t.tipo}>{t.tipo}</option>
                        ))}
                      </select>
                      <select
                        value={r.regiao}
                        onChange={(e) => {
                          const rg = regioesDe(r.tipo).find((x) => x.regiao === e.target.value);
                          updFill(i, { regiao: e.target.value, estado: "", baseId: rg?.baseId || "" });
                        }}
                        disabled={!r.tipo}
                        className={selCls}
                      >
                        <option value="">Região…</option>
                        {regioesDe(r.tipo).map((rg) => (
                          <option key={rg.regiao} value={rg.regiao}>{rg.regiao}</option>
                        ))}
                        {r.regiao && !regioesDe(r.tipo).some((x) => x.regiao === r.regiao) && (
                          <option value={r.regiao}>{r.regiao}</option>
                        )}
                      </select>
                      <select value={r.estado} onChange={(e) => updFill(i, { estado: e.target.value })} disabled={!r.regiao} className={selCls}>
                        <option value="">UF…</option>
                        {estadosDe(r.tipo, r.regiao).map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                        {r.estado && !estadosDe(r.tipo, r.regiao).includes(r.estado) && (
                          <option value={r.estado}>{r.estado}</option>
                        )}
                      </select>
                      <select value={r.prazo} onChange={(e) => updFill(i, { prazo: e.target.value })} className={selCls}>
                        <option value="diaria">Diária</option>
                        <option value="semanal">Semanal</option>
                        <option value="mensal">Mensal</option>
                      </select>
                      <input type="number" min={0} value={r.alvo} onChange={(e) => updFill(i, { alvo: e.target.value })} placeholder="0" className={numCls} />
                      <input type="date" value={r.dataLimite} onChange={(e) => updFill(i, { dataLimite: e.target.value })} title="Data-limite (opcional)" className={numCls} />
                      <button onClick={() => setFillRows((prev) => prev.filter((_, idx) => idx !== i))} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label="Remover linha">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6 7v12.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    </div>
                  ))}
                  {fillRows.length === 0 && <p className="py-3 text-center text-sm text-slate-400">Nenhuma meta de preenchimento.</p>}
                </div>
                <button onClick={addFill} disabled={tipos.length === 0} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                  Adicionar meta (tipo + região + estado)
                </button>
              </section>

              {/* ───── Correção ───── */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Correção de contatos</h3>
                <div className="mb-2 grid grid-cols-[2fr_0.8fr_0.6fr_0.9fr_auto] gap-2 px-1 text-xs font-medium text-slate-400">
                  <div>Campanha (HubSpot)</div>
                  <div>Prazo</div>
                  <div>Meta</div>
                  <div>Até</div>
                  <div />
                </div>
                <div className="space-y-2">
                  {corrRows.map((r, i) => (
                    <div key={i} className="grid grid-cols-[2fr_0.8fr_0.6fr_0.9fr_auto] items-center gap-2">
                      <select value={r.campanha} onChange={(e) => updCorr(i, { campanha: e.target.value })} className={selCls}>
                        <option value="">Selecione…</option>
                        {campanhas.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <select value={r.prazo} onChange={(e) => updCorr(i, { prazo: e.target.value })} className={selCls}>
                        <option value="diaria">Diária</option>
                        <option value="semanal">Semanal</option>
                        <option value="mensal">Mensal</option>
                      </select>
                      <input type="number" min={0} value={r.alvo} onChange={(e) => updCorr(i, { alvo: e.target.value })} placeholder="0" className={numCls} />
                      <input type="date" value={r.dataLimite} onChange={(e) => updCorr(i, { dataLimite: e.target.value })} title="Data-limite (opcional)" className={numCls} />
                      <button onClick={() => setCorrRows((prev) => prev.filter((_, idx) => idx !== i))} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label="Remover linha">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6 7v12.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    </div>
                  ))}
                  {corrRows.length === 0 && <p className="py-3 text-center text-sm text-slate-400">Nenhuma meta de correção.</p>}
                </div>
                <button onClick={addCorr} disabled={campanhas.length === 0} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                  Adicionar meta (campanha)
                </button>
              </section>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
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
