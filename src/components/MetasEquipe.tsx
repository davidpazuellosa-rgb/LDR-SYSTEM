"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";
import MetaModal from "@/components/MetaModal";

type MetaItem = {
  id: string;
  rotulo: string;
  tipo: string;
  prazo: string;
  feito: number;
  alvo: number;
  p: number;
  status: "ok" | "risco" | "atrasado";
};
type Ldr = { id: string; nome: string; metas: MetaItem[] };
type Periodo = { label: string; feito: number; alvo: number; hit: boolean };
type HistoricoItem = { id: string; tipo: string; prazo: string; rotulo: string; periodos: Periodo[]; streak: number };

const STATUS = {
  ok: { label: "No ritmo", chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" },
  risco: { label: "Em risco", chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500" },
  atrasado: { label: "Atrasado", chip: "bg-rose-50 text-rose-600", bar: "bg-rose-500" },
} as const;

const PRAZO_LABEL: Record<string, string> = { diaria: "Diária", semanal: "Semanal", mensal: "Mensal" };

const CARD = "rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm";
const selCls = "h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none focus:border-indigo-400";

// Pior situação entre as metas de um LDR (para o filtro por status e p/ "sem meta").
function piorStatus(metas: MetaItem[]): "ok" | "risco" | "atrasado" | "sem" {
  if (metas.length === 0) return "sem";
  const ordem = { ok: 0, risco: 1, atrasado: 2 } as const;
  return metas.reduce<"ok" | "risco" | "atrasado">((pior, m) => (ordem[m.status] > ordem[pior] ? m.status : pior), "ok");
}

export default function MetasEquipe({ ldrs }: { ldrs: Ldr[] }) {
  const router = useRouter();
  const [metaUser, setMetaUser] = useState<{ id: string; name: string } | null>(null);

  // Filtros — só nesta tela (não precisa de servidor: os dados já vieram todos).
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<"todos" | "ok" | "risco" | "atrasado" | "sem">("todos");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "preenchimento" | "correcao">("todos");
  const [prazoFiltro, setPrazoFiltro] = useState<"todos" | "diaria" | "semanal" | "mensal">("todos");

  // Histórico expandido por LDR (carregado sob demanda, guardado em cache simples).
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [historicos, setHistoricos] = useState<Record<string, HistoricoItem[] | "carregando" | "erro">>({});

  async function toggleHistorico(userId: string) {
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
    if (historicos[userId]) return; // já carregado (ou carregando)
    setHistoricos((prev) => ({ ...prev, [userId]: "carregando" }));
    try {
      const res = await fetch(apiPath(`/api/metas/${userId}/historico`));
      const data = await res.json();
      setHistoricos((prev) => ({ ...prev, [userId]: res.ok ? data.historico : "erro" }));
    } catch {
      setHistoricos((prev) => ({ ...prev, [userId]: "erro" }));
    }
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return ldrs.filter((u) => {
      if (q && !u.nome.toLowerCase().includes(q)) return false;
      if (statusFiltro !== "todos" && piorStatus(u.metas) !== statusFiltro) return false;
      if (tipoFiltro !== "todos" && !u.metas.some((m) => m.tipo === tipoFiltro)) return false;
      if (prazoFiltro !== "todos" && !u.metas.some((m) => m.prazo === prazoFiltro)) return false;
      return true;
    });
  }, [ldrs, busca, statusFiltro, tipoFiltro, prazoFiltro]);

  const filtrosAtivos = statusFiltro !== "todos" || tipoFiltro !== "todos" || prazoFiltro !== "todos" || busca.trim() !== "";

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-slate-500">
        Acompanhe as metas de cada LDR e crie/edite direto por aqui (ou em Usuários → Meta).
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar LDR…"
          className="h-8 w-48 rounded-lg border border-slate-200 px-2.5 text-xs outline-none focus:border-indigo-400"
        />
        <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value as typeof statusFiltro)} className={selCls}>
          <option value="todos">Toda situação</option>
          <option value="ok">No ritmo</option>
          <option value="risco">Em risco</option>
          <option value="atrasado">Atrasado</option>
          <option value="sem">Sem meta</option>
        </select>
        <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as typeof tipoFiltro)} className={selCls}>
          <option value="todos">Todo tipo</option>
          <option value="preenchimento">Preenchimento</option>
          <option value="correcao">Correção</option>
        </select>
        <select value={prazoFiltro} onChange={(e) => setPrazoFiltro(e.target.value as typeof prazoFiltro)} className={selCls}>
          <option value="todos">Todo prazo</option>
          <option value="diaria">Diária</option>
          <option value="semanal">Semanal</option>
          <option value="mensal">Mensal</option>
        </select>
        {filtrosAtivos && (
          <button
            onClick={() => {
              setBusca("");
              setStatusFiltro("todos");
              setTipoFiltro("todos");
              setPrazoFiltro("todos");
            }}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            Limpar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">{filtrados.length} de {ldrs.length} LDR(s)</span>
      </div>

      {filtrados.length === 0 ? (
        <div className={`${CARD} py-10 text-center text-sm text-slate-400`}>
          {ldrs.length === 0 ? "Nenhum LDR cadastrado ainda." : "Nenhum LDR bate com os filtros."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtrados.map((u) => {
            const hist = historicos[u.id];
            const aberto = abertos.has(u.id);
            return (
              <div key={u.id} className={CARD}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-800">{u.nome}</h3>
                    <p className="text-[11px] text-slate-400">{u.metas.length} meta(s)</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => toggleHistorico(u.id)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      {aberto ? "Ocultar histórico" : "Ver histórico"}
                    </button>
                    <button
                      onClick={() => setMetaUser({ id: u.id, name: u.nome })}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      {u.metas.length ? "Editar metas" : "Definir metas"}
                    </button>
                  </div>
                </div>

                {u.metas.length === 0 ? (
                  <p className="py-3 text-center text-xs text-slate-400">Sem metas definidas.</p>
                ) : (
                  <div className="space-y-3">
                    {u.metas.map((m) => {
                      const s = STATUS[m.status];
                      return (
                        <div key={m.id}>
                          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                            <span className="min-w-0 truncate text-slate-600">
                              {m.rotulo}
                              <span className="ml-1.5 text-[10px] text-slate-400">({PRAZO_LABEL[m.prazo] || m.prazo})</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="tabular-nums text-slate-400">{m.feito}/{m.alvo} · {m.p}%</span>
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${s.chip}`}>{s.label}</span>
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.max(2, m.p)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Histórico expandido — reaproveita o mesmo formato de "Minhas Metas" */}
                {aberto && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    {hist === "carregando" || hist === undefined ? (
                      <p className="py-2 text-center text-xs text-slate-400">Carregando histórico…</p>
                    ) : hist === "erro" ? (
                      <p className="py-2 text-center text-xs text-rose-500">Não foi possível carregar o histórico.</p>
                    ) : hist.length === 0 ? (
                      <p className="py-2 text-center text-xs text-slate-400">Sem histórico ainda (sem metas ou período muito recente).</p>
                    ) : (
                      <div className="space-y-3">
                        {hist.map((h) => (
                          <div key={h.id}>
                            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                              <span className="min-w-0 truncate text-slate-600">{h.rotulo}</span>
                              {h.streak > 0 && <span className="shrink-0 text-[10px] text-amber-600">🔥 {h.streak} seguidas</span>}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {h.periodos.map((p, i) => (
                                <div
                                  key={i}
                                  title={`${p.label}: ${p.feito}/${p.alvo}`}
                                  className={`flex min-w-[48px] flex-col items-center rounded-md border px-1.5 py-1 ${
                                    p.hit ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
                                  }`}
                                >
                                  <span className="text-[9px] text-slate-400">{p.label}</span>
                                  <span className={`text-[11px] font-semibold tabular-nums ${p.hit ? "text-emerald-700" : "text-slate-500"}`}>
                                    {p.feito}/{p.alvo}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {metaUser && (
        <MetaModal
          userId={metaUser.id}
          userName={metaUser.name}
          onClose={() => {
            setMetaUser(null);
            router.refresh(); // recarrega o progresso após salvar
          }}
        />
      )}
    </div>
  );
}
