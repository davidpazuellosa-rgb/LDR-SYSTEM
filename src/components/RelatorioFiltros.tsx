"use client";

import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";
import FiltrosCard, { Campo, SEGMENTADO, segBtn } from "@/components/FiltrosCard";
import ExportColunasButton from "@/components/ExportColunasButton";
import { EXPORT_COLS } from "@/lib/export-cols";

type Periodo = "semana" | "mes";

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
    "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none hover:bg-slate-50 focus:border-indigo-400";
  const ativos = (periodo !== "semana" ? 1 : 0) + (ldrId ? 1 : 0) + (campanha ? 1 : 0);

  return (
    <FiltrosCard
      ativos={ativos}
      onLimpar={() => router.push("/relatorios")}
      direita={
      <>
        {([["producao", "Produção"], ["metas", "Metas"]] as const).map(([tipo, label]) => (
          <ExportColunasButton
            key={tipo}
            href={exportHref(tipo)}
            colunas={EXPORT_COLS[tipo]}
            titulo={`Exportar ${label.toLowerCase()}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {label} CSV
          </ExportColunasButton>
        ))}
      </>
      }
    >
      <Campo titulo="Período">
        <div className={SEGMENTADO}>
          {([["semana", "Semana"], ["mes", "Mês"]] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => go({ periodo: v })} className={segBtn(periodo === v)}>{label}</button>
          ))}
        </div>
      </Campo>
      <Campo titulo="LDR">
        <select className={selCls} value={ldrId ?? ""} onChange={(e) => go({ ldr: e.target.value || null })} title="Filtrar por LDR">
          <option value="">Todos os LDRs</option>
          {ldrs.map((l) => (<option key={l.id} value={l.id}>{l.nome}</option>))}
        </select>
      </Campo>
      <Campo titulo="Campanha">
        <select className={selCls} value={campanha ?? ""} onChange={(e) => go({ campanha: e.target.value || null })} title="Filtrar por campanha">
          <option value="">Todas as campanhas</option>
          {campanhas.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
      </Campo>
    </FiltrosCard>
  );
}
