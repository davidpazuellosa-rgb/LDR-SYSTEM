"use client";

import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";

type Periodo = "semana" | "mes" | "tudo";

export default function RelatorioFiltros({
  periodo,
  ldrId,
  campanha,
  ldrs,
  campanhas,
}: {
  periodo: Periodo;
  ldrId: string | null;
  campanha: string | null;
  ldrs: { id: string; nome: string }[];
  campanhas: string[];
}) {
  const router = useRouter();

  function go(next: Partial<{ periodo: Periodo; ldr: string | null; campanha: string | null }>) {
    const params = new URLSearchParams();
    const p = next.periodo ?? periodo;
    const l = next.ldr === undefined ? ldrId : next.ldr;
    const c = next.campanha === undefined ? campanha : next.campanha;
    if (p && p !== "semana") params.set("periodo", p);
    if (l) params.set("ldr", l);
    if (c) params.set("campanha", c);
    const qs = params.toString();
    router.push(qs ? `/relatorios?${qs}` : "/relatorios");
  }

  // Link de exportação carrega os filtros atuais.
  const exportHref = (tipo: "producao" | "metas") => {
    const params = new URLSearchParams({ tipo, periodo });
    if (ldrId) params.set("ldr", ldrId);
    if (campanha) params.set("campanha", campanha);
    return apiPath(`/api/relatorios/export?${params.toString()}`);
  };

  const selCls =
    "h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-600 outline-none hover:bg-slate-50 focus:border-indigo-400";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Período */}
      <div className="flex items-center gap-1.5">
        {([
          ["semana", "Esta semana"],
          ["mes", "Este mês"],
          ["tudo", "Tudo"],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => go({ periodo: v })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              periodo === v ? "bg-indigo-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* LDR */}
      <select className={selCls} value={ldrId ?? ""} onChange={(e) => go({ ldr: e.target.value || null })} title="Filtrar por LDR">
        <option value="">Todos os LDRs</option>
        {ldrs.map((l) => (
          <option key={l.id} value={l.id}>{l.nome}</option>
        ))}
      </select>

      {/* Campanha */}
      <select className={selCls} value={campanha ?? ""} onChange={(e) => go({ campanha: e.target.value || null })} title="Filtrar por campanha">
        <option value="">Todas as campanhas</option>
        {campanhas.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {(ldrId || campanha) && (
        <button onClick={() => go({ ldr: null, campanha: null })} className="rounded-lg px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-100" title="Limpar filtros">
          Limpar
        </button>
      )}

      {/* Exportar CSV */}
      <div className="ml-auto flex items-center gap-1.5">
        <a href={exportHref("producao")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Produção (CSV)
        </a>
        <a href={exportHref("metas")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Metas (CSV)
        </a>
      </div>
    </div>
  );
}
