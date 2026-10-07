"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Dropdown from "@/components/Dropdown";
import FiltrosCard, { Campo } from "@/components/FiltrosCard";
import { SEGMENTADO } from "@/lib/ui-filtros";
import { PRESETS, PRESET_LABEL, type Preset } from "@/lib/producao-calc";

type Filtros = { orgao: string | null; regioes: string[]; estados: string[]; pessoas: string[]; campanhas: string[]; tipo: string; soSim?: boolean };

export default function ProducaoFiltros({
  preset,
  de,
  ate,
  filtros,
  opcoes,
}: {
  preset: Preset;
  de: string | null;
  ate: string | null;
  filtros: Filtros;
  opcoes: { pessoas: { id: string; nome: string }[]; arvore: Record<string, Record<string, string[]>>; campanhas: string[]; orgaos: string[] };
}) {
  const router = useRouter();
  const [dDe, setDDe] = useState(de || "");
  const [dAte, setDAte] = useState(ate || "");

  type Estado = { preset: Preset; de: string; ate: string } & Filtros;
  const atual: Estado = { preset, de: dDe, ate: dAte, ...filtros };

  function ir(patch: Partial<Estado>) {
    const n = { ...atual, ...patch };
    const p = new URLSearchParams();
    if (n.preset !== "7d") p.set("periodo", n.preset);
    if (n.preset === "personalizado") {
      if (n.de) p.set("de", n.de);
      if (n.ate) p.set("ate", n.ate);
    }
    if (n.orgao) p.set("orgao", n.orgao);
    if (n.regioes.length) p.set("regioes", n.regioes.join(","));
    if (n.estados.length) p.set("estados", n.estados.join(","));
    if (n.pessoas.length) p.set("pessoas", n.pessoas.join(","));
    if (n.campanhas.length) p.set("campanhas", n.campanhas.join(","));
    if (n.tipo !== "tudo") p.set("tipo", n.tipo);
    if (n.soSim) p.set("valor", "sim");
    const qs = p.toString();
    router.push(qs ? `/relatorios/producao?${qs}` : "/relatorios/producao");
  }

  // Cascata: órgão → regiões → estados (só o que existe de fato).
  const regioesDoOrgao = (orgao: string | null) =>
    orgao ? Object.keys(opcoes.arvore[orgao] || {}) : Array.from(new Set(Object.values(opcoes.arvore).flatMap((r) => Object.keys(r))));
  const regioesOpts = regioesDoOrgao(filtros.orgao).sort();
  const orgaosConsiderados = filtros.orgao ? [filtros.orgao] : opcoes.orgaos;
  const regioesConsideradas = filtros.regioes.length ? filtros.regioes : regioesOpts;
  const estadosOpts = Array.from(
    new Set(orgaosConsiderados.flatMap((o) => regioesConsideradas.flatMap((r) => opcoes.arvore[o]?.[r] || [])))
  ).sort();

  const chips: { rotulo: string; remover: () => void }[] = [];
  if (filtros.orgao) chips.push({ rotulo: filtros.orgao, remover: () => ir({ orgao: null, regioes: [], estados: [] }) });
  filtros.regioes.forEach((r) => chips.push({ rotulo: r, remover: () => ir({ regioes: filtros.regioes.filter((x) => x !== r), estados: [] }) }));
  filtros.estados.forEach((u) => chips.push({ rotulo: u, remover: () => ir({ estados: filtros.estados.filter((x) => x !== u) }) }));
  filtros.pessoas.forEach((id) => chips.push({ rotulo: opcoes.pessoas.find((p) => p.id === id)?.nome || id, remover: () => ir({ pessoas: filtros.pessoas.filter((x) => x !== id) }) }));
  filtros.campanhas.forEach((c) => chips.push({ rotulo: c, remover: () => ir({ campanhas: filtros.campanhas.filter((x) => x !== c) }) }));
  if (filtros.tipo !== "tudo") chips.push({ rotulo: filtros.tipo === "correcao" ? "Só correção" : filtros.tipo === "validacao" ? "Só validação" : "Só preenchimento", remover: () => ir({ tipo: "tudo" }) });

  if (filtros.soSim) chips.push({ rotulo: "Validação: só Sim", remover: () => ir({ soSim: false }) });

  const dateCls = "h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-indigo-400";

  const ativos = chips.length + (preset !== "7d" ? 1 : 0);

  return (
    <div className="space-y-2">
      <FiltrosCard ativos={ativos} onLimpar={() => router.push("/relatorios/producao")}>
      <Campo titulo="Período">
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown
            label="Período"
            multi={false}
            searchable={false}
            options={PRESETS.map((p) => ({ value: p, label: PRESET_LABEL[p] }))}
            value={[preset]}
            onChange={(v) => ir({ preset: (v[0] as Preset) || "7d" })}
          />
          {preset === "personalizado" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <input type="date" value={dDe} onChange={(e) => setDDe(e.target.value)} className={dateCls} aria-label="De" />
              <span className="text-xs text-slate-400">até</span>
              <input type="date" value={dAte} onChange={(e) => setDAte(e.target.value)} className={dateCls} aria-label="Até" />
              <button type="button" onClick={() => ir({ de: dDe, ate: dAte })} className="h-9 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700">
                Aplicar
              </button>
            </div>
          )}
        </div>
      </Campo>
      <Campo titulo="Órgão"><Dropdown label="Todos" options={opcoes.orgaos.map((o) => ({ value: o, label: o }))} value={filtros.orgao ? [filtros.orgao] : []} onChange={(v) => ir({ orgao: v[0] || null, regioes: [], estados: [] })} /></Campo>
      <Campo titulo="Região"><Dropdown label="Todas" multi options={regioesOpts.map((r) => ({ value: r, label: r }))} value={filtros.regioes} onChange={(v) => ir({ regioes: v, estados: [] })} /></Campo>
      <Campo titulo="Estado"><Dropdown label="Todos" multi options={estadosOpts.map((u) => ({ value: u, label: u }))} value={filtros.estados} onChange={(v) => ir({ estados: v })} /></Campo>
      <Campo titulo="Pessoa"><Dropdown label="Todas" multi options={opcoes.pessoas.map((p) => ({ value: p.id, label: p.nome }))} value={filtros.pessoas} onChange={(v) => ir({ pessoas: v })} /></Campo>
      <Campo titulo="Campanha"><Dropdown label="Todas" multi options={opcoes.campanhas.map((c) => ({ value: c, label: c }))} value={filtros.campanhas} onChange={(v) => ir({ campanhas: v })} /></Campo>
      <Campo titulo="Tipo de produção">
        <div className={SEGMENTADO}>
          {([["tudo", "Tudo"], ["preenchimento", "Preenchimento"], ["correcao", "Correção"], ["validacao", "Validação"]] as const).map(([v, t]) => (
            <button key={v} type="button" onClick={() => ir({ tipo: v })} className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${filtros.tipo === v ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800"}`}>
              {t}
            </button>
          ))}
        </div>
      </Campo>
      <Campo titulo="Como contar a validação">
        <div className={SEGMENTADO} title="Como contar as metas de validação">
          {([[false, "Sim + Não"], [true, "Só Sim"]] as const).map(([v, t]) => (
            <button key={t} type="button" onClick={() => ir({ soSim: v })} className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${!!filtros.soSim === v ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800"}`}>
              {t}
            </button>
          ))}
        </div>
      </Campo>
      </FiltrosCard>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
              {c.rotulo}
              <button type="button" onClick={c.remover} aria-label={`Remover ${c.rotulo}`} className="text-indigo-400 hover:text-indigo-700">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
