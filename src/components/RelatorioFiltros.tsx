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
    "h-8 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none hover:bg-slate-50 focus:border-indigo-400";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Período — controle segmentado */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
        {([
          ["semana", "Semana"],
          ["mes", "Mês"],
          ["tudo", "Tudo"],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => go({ periodo: v })}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              periodo === v ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <select className={selCls} value={ldrId ?? ""} onChange={(e) => go({ ldr: e.target.value || null })} title="Filtrar por LDR">
        <option value="">Todos os LDRs</option>
        {ldrs.map((l) => (
          <option key={l.id} value={l.id}>{l.nome}</option>
        ))}
      </select>

      <select className={selCls} value={campanha ?? ""} onChange={(e) => go({ campanha: e.target.value || null })} title="Filtrar por campanha">
        <option value="">Todas as campanhas</option>
        {campanhas.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {(ldrId || campanha) && (
        <button onClick={() => go({ ldr: null, campanha: null })} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-slate-700" title="Limpar filtros">
          Limpar
        </button>
      )}

      {/* Exportar CSV — botões discretos */}
      <div className="ml-auto flex items-center gap-1.5">
        {([["producao", "Produção"], ["metas", "Metas"]] as const).map(([tipo, label]) => (
          <a
            key={tipo}
            href={exportHref(tipo)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {label} CSV
          </a>
        ))}
      </div>
    </div>
  );
}
