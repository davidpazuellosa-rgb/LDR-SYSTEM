"use client";

import { useEffect, useState } from "react";
import { apiPath } from "@/lib/path";
import { useToast } from "@/components/Toast";

type RegiaoOpt = { regiao: string; baseId: string; estados: string[] };
type TipoOpt = { tipo: string; regioes: RegiaoOpt[] };
type FillRow = { tipo: string; regiao: string; estado: string; baseId: string; prazo: string; alvo: string };
type CorrRow = { campanha: string; prazo: string; alvo: string };

type MetaIn = {
  tipo?: string;
  baseId?: string | null;
  regiao?: string | null;
  estado?: string | null;
  campanha?: string | null;
  prazo?: string;
  alvo?: number;
};

const fillKey = (r: { tipo: string; regiao: string; estado: string }) => `${r.tipo}|${r.regiao}|${r.estado}`;

const selCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400";
const numCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500";

export default function MetaModal({ userId, userName, onClose }: { userId: string; userName: string; onClose: () => void }) {
  const toast = useToast();
  const [tipos, setTipos] = useState<TipoOpt[]>([]);
  const [campanhas, setCampanhas] = useState<string[]>([]);
  const [fillRows, setFillRows] = useState<FillRow[]>([]);
  const [corrRows, setCorrRows] = useState<CorrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aba, setAba] = useState<"preenchimento" | "correcao">("preenchimento");
  // Montador de metas em lote (preenchimento)
  const [bTipo, setBTipo] = useState("");
  const [bRegioes, setBRegioes] = useState<string[]>([]);
  const [bEstados, setBEstados] = useState<string[]>([]);
  const [bPrazo, setBPrazo] = useState("semanal");
  const [bAlvo, setBAlvo] = useState("");
  const [bModo, setBModo] = useState<"cada" | "total">("cada");
  // Montador (correção)
  const [cCamps, setCCamps] = useState<string[]>([]);
  const [cPrazo, setCPrazo] = useState("semanal");
  const [cAlvo, setCAlvo] = useState("");

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
              }))
          );
          setCorrRows(
            metas
              .filter((m) => m.tipo === "correcao")
              .map((m) => ({
                campanha: m.campanha || "",
                prazo: m.prazo === "mensal" ? "mensal" : m.prazo === "diaria" ? "diaria" : "semanal",
                alvo: String(m.alvo ?? 0),
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
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // Estados disponíveis = união dos estados das regiões escolhidas.
  const regioesEscolhidas = regioesDe(bTipo).filter((r) => bRegioes.includes(r.regiao));
  const estadosDisponiveis = Array.from(new Set(regioesEscolhidas.flatMap((r) => r.estados))).sort();

  function updFill(key: string, patch: Partial<FillRow>) {
    setFillRows((prev) => prev.map((r) => (fillKey(r) === key ? { ...r, ...patch } : r)));
  }
  function updCorr(campanha: string, patch: Partial<CorrRow>) {
    setCorrRows((prev) => prev.map((r) => (r.campanha === campanha ? { ...r, ...patch } : r)));
  }

  function adicionarPreenchimento() {
    const alvoNum = Math.max(0, Math.trunc(Number(bAlvo) || 0));
    const novos: FillRow[] = [];
    for (const rg of regioesEscolhidas) {
      for (const uf of rg.estados) {
        if (bEstados.includes(uf)) novos.push({ tipo: bTipo, regiao: rg.regiao, estado: uf, baseId: rg.baseId, prazo: bPrazo, alvo: "" });
      }
    }
    if (novos.length === 0) {
      setError("Escolha o tipo de órgão, ao menos uma região e ao menos um estado.");
      return;
    }
    // "Total dividido": reparte a meta entre os estados (o resto vai para os primeiros).
    novos.forEach((n, i) => {
      const base = bModo === "total" ? Math.floor(alvoNum / novos.length) + (i < alvoNum % novos.length ? 1 : 0) : alvoNum;
      n.alvo = String(base);
    });
    const existentes = new Set(fillRows.map(fillKey));
    const aAdicionar = novos.filter((n) => !existentes.has(fillKey(n)));
    setError(null);
    setFillRows((prev) => [...prev, ...aAdicionar]);
    const dup = novos.length - aAdicionar.length;
    toast.success(`${aAdicionar.length} meta(s) adicionada(s).`, dup ? `${dup} já existia(m) e foi(ram) mantida(s).` : "Revise e clique em Salvar metas.");
    setBEstados([]);
    setBAlvo("");
  }

  function adicionarCorrecao() {
    const alvoNum = String(Math.max(0, Math.trunc(Number(cAlvo) || 0)));
    const existentes = new Set(corrRows.map((r) => r.campanha));
    const novos = cCamps.filter((c) => !existentes.has(c)).map((c) => ({ campanha: c, prazo: cPrazo, alvo: alvoNum }));
    if (cCamps.length === 0) {
      setError("Escolha ao menos uma campanha.");
      return;
    }
    setError(null);
    setCorrRows((prev) => [...prev, ...novos]);
    toast.success(`${novos.length} meta(s) adicionada(s).`, "Revise e clique em Salvar metas.");
    setCCamps([]);
    setCAlvo("");
  }

  async function save() {
    setSaving(true);
    setError(null);
    const loadingId = toast.loading("Salvando metas...", userName);
    try {
      const metas = [
        ...fillRows
          .filter((r) => r.baseId && r.regiao && r.estado)
          .map((r) => ({ tipo: "preenchimento", baseId: r.baseId, regiao: r.regiao, estado: r.estado, prazo: r.prazo, alvo: r.alvo })),
        ...corrRows
          .filter((r) => r.campanha)
          .map((r) => ({ tipo: "correcao", campanha: r.campanha, prazo: r.prazo, alvo: r.alvo })),
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

  // Metas de preenchimento agrupadas por tipo · região (para a lista).
  const grupos = new Map<string, FillRow[]>();
  for (const r of fillRows) {
    const k = `${r.tipo || "Órgão"} · ${r.regiao}`;
    grupos.set(k, [...(grupos.get(k) || []), r]);
  }

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm font-medium transition ${
      on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
    }`;
  const lbl = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  const PrazoSeg = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {[["diaria", "Diária"], ["semanal", "Semanal"], ["mensal", "Mensal"]].map(([v, t]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${value === v ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          {t}
        </button>
      ))}
    </div>
  );

  const trash = (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6 7v12.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
  const totalPreench = fillRows.reduce((a, r) => a + (Number(r.alvo) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white text-slate-800 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-indigo-100 text-base font-bold text-indigo-700">
              {userName.trim().charAt(0).toUpperCase()}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Metas de {userName}</h2>
              <p className="text-sm text-slate-500">Monte metas para vários estados de uma vez e ajuste cada uma depois.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fechar">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-100 px-6 pt-3">
          {([["preenchimento", "Preenchimento", fillRows.length], ["correcao", "Correção", corrRows.length]] as const).map(([v, t, n]) => (
            <button
              key={v}
              type="button"
              onClick={() => setAba(v)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition ${
                aba === v ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t}
              <span className={`rounded-full px-2 py-0.5 text-xs ${aba === v ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>{n}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Carregando…</p>
          ) : aba === "preenchimento" ? (
            <>
              {/* Montador */}
              <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="text-sm font-semibold text-slate-700">Nova meta de preenchimento</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={lbl}>Tipo de órgão</span>
                    <select
                      value={bTipo}
                      onChange={(e) => {
                        setBTipo(e.target.value);
                        setBRegioes([]);
                        setBEstados([]);
                      }}
                      className={selCls}
                    >
                      <option value="">Selecione…</option>
                      {tipos.map((t) => (
                        <option key={t.tipo} value={t.tipo}>{t.tipo}</option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <span className={lbl}>Prazo</span>
                    <PrazoSeg value={bPrazo} onChange={setBPrazo} />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Regiões</span>
                    {bTipo && (
                      <button type="button" className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => setBRegioes(bRegioes.length === regioesDe(bTipo).length ? [] : regioesDe(bTipo).map((r) => r.regiao))}>
                        {bRegioes.length === regioesDe(bTipo).length ? "Limpar" : "Todas"}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!bTipo && <span className="text-sm text-slate-400">Escolha o tipo de órgão primeiro.</span>}
                    {regioesDe(bTipo).map((r) => (
                      <button key={r.regiao} type="button" className={chip(bRegioes.includes(r.regiao))} onClick={() => setBRegioes(toggle(bRegioes, r.regiao))}>
                        {r.regiao}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estados</span>
                    {estadosDisponiveis.length > 0 && (
                      <button type="button" className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => setBEstados(bEstados.length === estadosDisponiveis.length ? [] : estadosDisponiveis)}>
                        {bEstados.length === estadosDisponiveis.length ? "Limpar" : "Todos"}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {estadosDisponiveis.length === 0 && <span className="text-sm text-slate-400">Escolha ao menos uma região.</span>}
                    {estadosDisponiveis.map((uf) => (
                      <button key={uf} type="button" className={chip(bEstados.includes(uf))} onClick={() => setBEstados(toggle(bEstados, uf))}>
                        {uf}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-4">
                  <label className="block w-36">
                    <span className={lbl}>Meta</span>
                    <input type="number" min={0} value={bAlvo} onChange={(e) => setBAlvo(e.target.value)} placeholder="0" className={numCls} />
                  </label>
                  <div>
                    <span className={lbl}>Como aplicar</span>
                    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                      {([["cada", "Para cada estado"], ["total", "Total dividido"]] as const).map(([v, t]) => (
                        <button key={v} type="button" onClick={() => setBModo(v)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${bModo === v ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={adicionarPreenchimento} className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                    Adicionar {bEstados.length > 0 ? `(${bEstados.length} estado${bEstados.length > 1 ? "s" : ""})` : ""}
                  </button>
                </div>
              </section>

              {/* Lista */}
              <section>
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Metas de preenchimento</h3>
                  {fillRows.length > 0 && <span className="text-xs text-slate-400">{fillRows.length} meta(s) · soma {totalPreench.toLocaleString("pt-BR")}</span>}
                </div>
                {fillRows.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">Nenhuma meta de preenchimento ainda.</p>}
                <div className="space-y-3">
                  {[...grupos.entries()].map(([nome, rows]) => (
                    <div key={nome} className="overflow-hidden rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between bg-slate-50 px-4 py-2">
                        <span className="text-sm font-semibold text-slate-700">{nome}</span>
                        <button type="button" onClick={() => setFillRows((prev) => prev.filter((x) => !rows.includes(x)))} className="text-xs font-medium text-slate-400 hover:text-red-500">
                          Remover grupo
                        </button>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {rows.map((r) => {
                          const k = fillKey(r);
                          return (
                            <div key={k} className="flex items-center gap-3 px-4 py-2">
                              <span className="w-10 text-sm font-semibold text-slate-700">{r.estado}</span>
                              <select value={r.prazo} onChange={(e) => updFill(k, { prazo: e.target.value })} className={`${selCls} !w-32`}>
                                <option value="diaria">Diária</option>
                                <option value="semanal">Semanal</option>
                                <option value="mensal">Mensal</option>
                              </select>
                              <input type="number" min={0} value={r.alvo} onChange={(e) => updFill(k, { alvo: e.target.value })} className={`${numCls} !w-28`} />
                              <button type="button" onClick={() => setFillRows((prev) => prev.filter((x) => fillKey(x) !== k))} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label="Remover">
                                {trash}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="text-sm font-semibold text-slate-700">Nova meta de correção</h3>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Campanhas (HubSpot)</span>
                    {campanhas.length > 0 && (
                      <button type="button" className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => setCCamps(cCamps.length === campanhas.length ? [] : campanhas)}>
                        {cCamps.length === campanhas.length ? "Limpar" : "Todas"}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {campanhas.length === 0 && <span className="text-sm text-slate-400">Nenhuma campanha ativa encontrada.</span>}
                    {campanhas.map((c) => (
                      <button key={c} type="button" className={chip(cCamps.includes(c))} onClick={() => setCCamps(toggle(cCamps, c))}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <span className={lbl}>Prazo</span>
                    <PrazoSeg value={cPrazo} onChange={setCPrazo} />
                  </div>
                  <label className="block w-36">
                    <span className={lbl}>Meta (cada)</span>
                    <input type="number" min={0} value={cAlvo} onChange={(e) => setCAlvo(e.target.value)} placeholder="0" className={numCls} />
                  </label>
                  <button type="button" onClick={adicionarCorrecao} className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                    Adicionar {cCamps.length > 0 ? `(${cCamps.length})` : ""}
                  </button>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Metas de correção</h3>
                {corrRows.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">Nenhuma meta de correção ainda.</p>}
                <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                  {corrRows.map((r) => (
                    <div key={r.campanha} className="flex items-center gap-3 px-4 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{r.campanha}</span>
                      <select value={r.prazo} onChange={(e) => updCorr(r.campanha, { prazo: e.target.value })} className={`${selCls} !w-32`}>
                        <option value="diaria">Diária</option>
                        <option value="semanal">Semanal</option>
                        <option value="mensal">Mensal</option>
                      </select>
                      <input type="number" min={0} value={r.alvo} onChange={(e) => updCorr(r.campanha, { alvo: e.target.value })} className={`${numCls} !w-28`} />
                      <button type="button" onClick={() => setCorrRows((prev) => prev.filter((x) => x.campanha !== r.campanha))} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label="Remover">
                        {trash}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
          <p className="text-xs text-slate-400">As mudanças só valem depois de clicar em “Salvar metas”.</p>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={save} disabled={saving || loading} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? "Salvando…" : "Salvar metas"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
