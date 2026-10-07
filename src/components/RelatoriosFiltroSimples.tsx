"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Dropdown from "@/components/Dropdown";
import FiltrosCard, { Campo } from "@/components/FiltrosCard";
import { PRESETS, PRESET_LABEL, type Preset } from "@/lib/producao-calc";

// Filtro simples das abas do admin: período + (opcional) "Ver de quem". `base` = rota da aba.
export default function RelatoriosFiltroSimples({
  base, preset, de, ate, pessoa, pessoas,
}: { base: string; preset: Preset; de: string | null; ate: string | null; pessoa: string | null; pessoas?: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [dDe, setDDe] = useState(de || "");
  const [dAte, setDAte] = useState(ate || "");

  function ir(patch: Partial<{ preset: Preset; de: string; ate: string; pessoa: string | null }>) {
    const n = { preset, de: dDe, ate: dAte, pessoa, ...patch };
    const p = new URLSearchParams();
    if (n.preset !== "7d") p.set("periodo", n.preset);
    if (n.preset === "personalizado") {
      if (n.de) p.set("de", n.de);
      if (n.ate) p.set("ate", n.ate);
    }
    if (n.pessoa) p.set("pessoa", n.pessoa);
    const qs = p.toString();
    router.push(qs ? `${base}?${qs}` : base);
  }
  const dateCls = "h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-indigo-400";
  const ativos = (pessoa ? 1 : 0) + (preset !== "7d" ? 1 : 0);
  return (
    <FiltrosCard ativos={ativos} onLimpar={() => router.push(base)}>
      <Campo titulo="Período">
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown label="Período" multi={false} searchable={false} options={PRESETS.map((p) => ({ value: p, label: PRESET_LABEL[p] }))} value={[preset]} onChange={(v) => ir({ preset: (v[0] as Preset) || "7d" })} />
          {preset === "personalizado" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <input type="date" value={dDe} onChange={(e) => setDDe(e.target.value)} className={dateCls} aria-label="De" />
              <span className="text-xs text-slate-400">até</span>
              <input type="date" value={dAte} onChange={(e) => setDAte(e.target.value)} className={dateCls} aria-label="Até" />
              <button type="button" onClick={() => ir({ de: dDe, ate: dAte })} className="h-9 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700">Aplicar</button>
            </div>
          )}
        </div>
      </Campo>
      {pessoas && (
        <Campo titulo="Ver de quem">
          <Dropdown label="Toda a equipe" options={pessoas.map((p) => ({ value: p.id, label: p.nome }))} value={pessoa ? [pessoa] : []} onChange={(v) => ir({ pessoa: v[0] || null })} />
        </Campo>
      )}
    </FiltrosCard>
  );
}
