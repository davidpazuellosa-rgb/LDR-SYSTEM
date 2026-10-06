"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Dropdown from "@/components/Dropdown";
import { PRESETS, PRESET_LABEL, type Preset } from "@/lib/producao-calc";

// Filtros do Ranking: período, órgão e como contar a validação (Sim + Não | só Sim).
export default function RankingFiltros({
  preset, de, ate, orgao, soSim, orgaos,
}: { preset: Preset; de: string | null; ate: string | null; orgao: string | null; soSim: boolean; orgaos: string[] }) {
  const router = useRouter();
  const [dDe, setDDe] = useState(de || "");
  const [dAte, setDAte] = useState(ate || "");

  function ir(patch: Partial<{ preset: Preset; de: string; ate: string; orgao: string | null; soSim: boolean }>) {
    const n = { preset, de: dDe, ate: dAte, orgao, soSim, ...patch };
    const p = new URLSearchParams();
    if (n.preset !== "7d") p.set("periodo", n.preset);
    if (n.preset === "personalizado") {
      if (n.de) p.set("de", n.de);
      if (n.ate) p.set("ate", n.ate);
    }
    if (n.orgao) p.set("orgao", n.orgao);
    if (n.soSim) p.set("valor", "sim");
    const qs = p.toString();
    router.push(qs ? `/ranking?${qs}` : "/ranking");
  }
  const dateCls = "h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-indigo-400";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dropdown label="Período" multi={false} searchable={false} options={PRESETS.map((p) => ({ value: p, label: PRESET_LABEL[p] }))} value={[preset]} onChange={(v) => ir({ preset: (v[0] as Preset) || "7d" })} />
      {preset === "personalizado" && (
        <div className="flex items-center gap-1.5">
          <input type="date" value={dDe} onChange={(e) => setDDe(e.target.value)} className={dateCls} aria-label="De" />
          <span className="text-xs text-slate-400">até</span>
          <input type="date" value={dAte} onChange={(e) => setDAte(e.target.value)} className={dateCls} aria-label="Até" />
          <button type="button" onClick={() => ir({ de: dDe, ate: dAte })} className="h-9 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700">Aplicar</button>
        </div>
      )}
      <Dropdown label="Órgão" options={orgaos.map((o) => ({ value: o, label: o }))} value={orgao ? [orgao] : []} onChange={(v) => ir({ orgao: v[0] || null })} />
      <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5" title="Como contar a validação">
        <span className="px-2 text-xs text-slate-400">Validação</span>
        {([[false, "Sim + Não"], [true, "Só Sim"]] as const).map(([v, t]) => (
          <button key={t} type="button" onClick={() => ir({ soSim: v })} className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${soSim === v ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800"}`}>
            {t}
          </button>
        ))}
      </div>
      {(orgao || soSim || preset !== "7d") && (
        <button type="button" onClick={() => router.push("/ranking")} className="h-9 rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-red-500">Limpar tudo</button>
      )}
    </div>
  );
}
