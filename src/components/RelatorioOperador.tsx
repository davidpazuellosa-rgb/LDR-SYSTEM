"use client";

import { useMemo, useState } from "react";
import { ufSigla } from "@/lib/uf";

// Relatório do próprio operador (LDR / Pré-vendedor). TODOS os dados são só dele —
// não há seletor de outras pessoas. Corrigidos e "não encontrados" são atribuídos
// por "quem resolveu"; a fila é o total geral (contexto), rotulada como tal.
export type RelatorioRow = {
  status: string; // "resolved" | "nao_encontrado"
  oldValue: string | null;
  newValue: string | null;
  resolvedAt: string | null; // ISO
  cidade: string | null;
  estado: string | null;
  campanha: string | null;
  regiao: string | null;
};

const PERIODOS = [
  { key: "7", label: "7 dias" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "mes", label: "Este mês" },
  { key: "tudo", label: "Tudo" },
] as const;
type PeriodoKey = (typeof PERIODOS)[number]["key"];

const CORR_COLOR = "#6366f1"; // indigo-500
const NAO_COLOR = "#a1a1aa"; // zinc-400

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function uniqSorted(values: (string | null)[]) {
  return Array.from(new Set(values.map((v) => (v || "").trim()).filter(Boolean))).sort();
}

// ---- Gráfico de pizza (donut) em SVG ----
function Donut({ slices, size = 168 }: { slices: { label: string; value: number; color: string }[]; size?: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = size / 2;
  const cx = r;
  const cy = r;
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Sem dados">
        <circle cx={cx} cy={cy} r={r - 1} fill="none" stroke="#e2e8f0" strokeWidth="14" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#94a3b8" fontSize="12">sem dados</text>
      </svg>
    );
  }
  let angle = -Math.PI / 2;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s, i) => {
      const frac = s.value / total;
      const a0 = angle;
      const a1 = angle + frac * Math.PI * 2;
      angle = a1;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const x0 = cx + r * Math.cos(a0);
      const y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      return <path key={i} d={`M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`} fill={s.color} />;
    });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribuição dos resultados">
      {arcs}
      <circle cx={cx} cy={cy} r={r * 0.58} fill="white" />
      <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="central" fill="#1e293b" fontSize="22" fontWeight="600">{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="central" fill="#94a3b8" fontSize="11">trabalhados</text>
    </svg>
  );
}

function StatCard({ label, value, hint, color }: { label: string; value: number | string; hint: string; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-sm font-medium text-slate-700">{label}</div>
      <div className="text-xs text-slate-400">{hint}</div>
    </div>
  );
}

export default function RelatorioOperador({ rows, filaGlobal }: { rows: RelatorioRow[]; filaGlobal: number }) {
  const [periodo, setPeriodo] = useState<PeriodoKey>("30");
  const [campanha, setCampanha] = useState("all");
  const [uf, setUf] = useState("all");

  const campanhas = useMemo(() => uniqSorted(rows.map((r) => r.campanha)), [rows]);
  const ufs = useMemo(
    () => Array.from(new Set(rows.map((r) => ufSigla(r.estado)).filter(Boolean))).sort(),
    [rows],
  );

  // Início do período selecionado.
  const now = new Date();
  const startDate = useMemo(() => {
    if (periodo === "mes") return new Date(now.getFullYear(), now.getMonth(), 1);
    if (periodo === "tudo") {
      const times = rows.map((r) => (r.resolvedAt ? new Date(r.resolvedAt).getTime() : NaN)).filter((t) => !isNaN(t));
      if (!times.length) return startOfDay(new Date(now.getTime() - 29 * 86400000));
      return startOfDay(new Date(Math.min(...times)));
    }
    const d = startOfDay(now);
    d.setDate(d.getDate() - (Number(periodo) - 1));
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, rows]);

  const filtered = useMemo(() => {
    const startMs = startDate.getTime();
    return rows.filter((r) => {
      if (!r.resolvedAt) return false;
      if (new Date(r.resolvedAt).getTime() < startMs) return false;
      if (campanha !== "all" && (r.campanha || "") !== campanha) return false;
      if (uf !== "all" && ufSigla(r.estado) !== uf) return false;
      return true;
    });
  }, [rows, startDate, campanha, uf]);

  const corrigidos = filtered.filter((r) => r.status === "resolved");
  const naoEncontrados = filtered.filter((r) => r.status === "nao_encontrado");
  const totalTrab = corrigidos.length + naoEncontrados.length;
  const taxa = totalTrab ? Math.round((corrigidos.length / totalTrab) * 100) : 0;

  // Buckets do gráfico de barras (dia; se o período for longo, agrupa por semana).
  const buckets = useMemo(() => {
    const startMs = startOfDay(startDate).getTime();
    const spanDays = Math.max(1, Math.ceil((startOfDay(now).getTime() - startMs) / 86400000) + 1);
    const step = spanDays > 45 ? 7 : 1;
    const n = Math.min(60, Math.ceil(spanDays / step));
    const arr = Array.from({ length: n }, (_, i) => {
      const d = new Date(startMs + i * step * 86400000);
      return { label: `${d.getDate()}/${d.getMonth() + 1}`, corr: 0, nao: 0 };
    });
    for (const r of filtered) {
      if (!r.resolvedAt) continue;
      const idx = Math.floor((startOfDay(new Date(r.resolvedAt)).getTime() - startMs) / (step * 86400000));
      if (idx < 0 || idx >= n) continue;
      if (r.status === "resolved") arr[idx].corr += 1;
      else arr[idx].nao += 1;
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, startDate]);
  const maxBar = Math.max(1, ...buckets.map((b) => b.corr + b.nao));

  // Por campanha (barras horizontais).
  const porCampanha = useMemo(() => {
    const map = new Map<string, { corr: number; nao: number }>();
    for (const r of filtered) {
      const key = (r.campanha || "Sem campanha").trim();
      const cur = map.get(key) || { corr: 0, nao: 0 };
      if (r.status === "resolved") cur.corr += 1;
      else cur.nao += 1;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([campanha, v]) => ({ campanha, ...v, total: v.corr + v.nao }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filtered]);
  const maxCamp = Math.max(1, ...porCampanha.map((c) => c.total));

  const selectCls =
    "h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-600 outline-none focus:border-indigo-500";

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
          {PERIODOS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                periodo === p.key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select value={campanha} onChange={(e) => setCampanha(e.target.value)} className={selectCls} title="Campanha">
          <option value="all">Todas as campanhas</option>
          {campanhas.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={uf} onChange={(e) => setUf(e.target.value)} className={selectCls} title="Estado (UF)">
          <option value="all">Todos os estados</option>
          {ufs.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Corrigidos" value={corrigidos.length} hint="telefones que você achou" color="text-indigo-600" />
        <StatCard label="Não encontrados" value={naoEncontrados.length} hint="pesquisados sem número" color="text-zinc-600" />
        <StatCard label="Taxa de sucesso" value={`${taxa}%`} hint="corrigidos / trabalhados" color="text-emerald-600" />
        <StatCard label="Pendentes na fila" value={filaGlobal} hint="a corrigir (fila geral)" color="text-amber-600" />
      </div>

      {/* Produção por dia + pizza */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-1 font-semibold text-slate-800">Sua produção no período</h2>
          <p className="mb-4 text-xs text-slate-400">
            Corrigidos <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: CORR_COLOR }} /> ·
            Não encontrados <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: NAO_COLOR }} />
          </p>
          <div className="flex h-44 items-end gap-1">
            {buckets.map((b, i) => {
              const totalH = ((b.corr + b.nao) / maxBar) * 100;
              const corrH = b.corr + b.nao ? (b.corr / (b.corr + b.nao)) * totalH : 0;
              const naoH = totalH - corrH;
              return (
                <div
                  key={i}
                  className="flex flex-1 flex-col justify-end"
                  title={`${b.label}: ${b.corr} corrigido(s), ${b.nao} não encontrado(s)`}
                >
                  {b.nao > 0 && <div className="rounded-t" style={{ height: `${naoH}%`, background: NAO_COLOR }} />}
                  {b.corr > 0 && (
                    <div className={b.nao > 0 ? "" : "rounded-t"} style={{ height: `${corrH}%`, background: CORR_COLOR }} />
                  )}
                  {b.corr + b.nao === 0 && <div className="rounded-t bg-slate-100" style={{ height: "2%" }} />}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>{buckets[0]?.label}</span>
            <span>{buckets[buckets.length - 1]?.label}</span>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-800">Seus resultados</h2>
          <div className="flex items-center justify-center">
            <Donut
              slices={[
                { label: "Corrigidos", value: corrigidos.length, color: CORR_COLOR },
                { label: "Não encontrados", value: naoEncontrados.length, color: NAO_COLOR },
              ]}
            />
          </div>
          <div className="mt-4 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORR_COLOR }} /> Corrigidos
              </span>
              <span className="font-medium text-slate-800">{corrigidos.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: NAO_COLOR }} /> Não encontrados
              </span>
              <span className="font-medium text-slate-800">{naoEncontrados.length}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Por campanha */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-800">Por campanha</h2>
        {porCampanha.length === 0 ? (
          <p className="text-sm text-slate-400">Sem produção no período/filtro selecionado.</p>
        ) : (
          <div className="space-y-3">
            {porCampanha.map((c) => (
              <div key={c.campanha}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-slate-700">{c.campanha}</span>
                  <span className="shrink-0 text-slate-400">
                    {c.corr} corrigidos · {c.nao} não encontrados
                  </span>
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div style={{ width: `${(c.corr / maxCamp) * 100}%`, background: CORR_COLOR }} />
                  <div style={{ width: `${(c.nao / maxCamp) * 100}%`, background: NAO_COLOR }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tabela detalhada */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-800">Detalhado <span className="text-sm font-normal text-slate-400">({filtered.length})</span></h2>
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum registro no período/filtro selecionado.</p>
        ) : (
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 font-medium">Prefeitura</th>
                  <th className="py-2 font-medium">Campanha</th>
                  <th className="py-2 font-medium">Resultado</th>
                  <th className="py-2 font-medium">De → Para</th>
                  <th className="py-2 text-right font-medium">Quando</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-2 text-slate-700">
                      {[r.cidade, ufSigla(r.estado)].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="py-2 text-slate-500">{r.campanha || "—"}</td>
                    <td className="py-2">
                      {r.status === "resolved" ? (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">Corrigido</span>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">Não encontrado</span>
                      )}
                    </td>
                    <td className="py-2 text-slate-500">
                      {r.status === "resolved" ? `${r.oldValue || "—"} → ${r.newValue || "—"}` : "—"}
                    </td>
                    <td className="py-2 text-right text-slate-400">{fmtDate(r.resolvedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
