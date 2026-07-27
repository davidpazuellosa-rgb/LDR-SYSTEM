"use client";

import { useCallback, useEffect, useState } from "react";
import { PageTitle } from "@/components/TitleContext";
import {
  type AgendaData,
  type Meeting,
  type ResultCat,
  RESULT_META,
  RESULT_ORDER,
  outcomeLabel,
  resultCat,
  parseHubspotDate,
  ownerName,
} from "@/lib/agenda";

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOUR_PX = 48; // altura de 1 hora na grade de Semana/Dia
const PORTAL_ID = "23563863";
type View = "mes" | "semana" | "dia";
type EventoDia = Meeting & { _dt: Date };

function dateKey(d: Date) {
  return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
}
function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function horaCurta(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes();
  return m === 0 ? h + "h" : String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}
function hubspotDealUrl(dealId: string) {
  return `https://app.hubspot.com/contacts/${PORTAL_ID}/record/0-3/${dealId}`;
}
// Corpo da reunião vem em HTML — exibimos como TEXTO (sem injetar HTML → sem XSS).
function htmlToText(html: string) {
  if (!html) return "";
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}
function fmtDataHora(d: Date) {
  return (
    capitalize(d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "long", year: "numeric" })) +
    " · " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function Agenda() {
  const [data, setData] = useState<AgendaData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "erro">("idle");
  const [err, setErr] = useState("");
  const [mounted, setMounted] = useState(false);

  const [view, setView] = useState<View>("mes");
  const [refIso, setRefIso] = useState<string | null>(null);
  const [miniIso, setMiniIso] = useState<string | null>(null);
  const [hiddenResults, setHiddenResults] = useState<Set<ResultCat>>(new Set());
  const [hiddenOwners, setHiddenOwners] = useState<Set<string>>(new Set());
  const [weekends, setWeekends] = useState(true);
  const [selected, setSelected] = useState<Meeting | null>(null);

  const load = useCallback(async (force?: boolean) => {
    setStatus("loading");
    try {
      const url = force ? "/api/agenda?fresh=1&_=" + Date.now() : "/api/agenda";
      const r = await fetch(url, { cache: "no-store" });
      const j: AgendaData = await r.json();
      if (j && j.available) {
        setData(j);
        setStatus("ok");
      } else {
        setErr((j && j.error) || "resposta inválida");
        setStatus("erro");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setStatus("erro");
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    load();
  }, [load]);

  // Atalhos de teclado (D/S/M/T + setas), ignorando digitação e modal aberto.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = ((e.target as HTMLElement)?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (selected) return;
      const k = e.key.toLowerCase();
      if (k === "d") setView("dia");
      else if (k === "s") setView("semana");
      else if (k === "m") setView("mes");
      else if (k === "t") setRefIso(null);
      else if (e.key === "ArrowLeft") shiftRef(-1);
      else if (e.key === "ArrowRight") shiftRef(1);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // shiftRef usa `view` via closure; re-inscreve quando view/selected mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selected]);

  // Fecha o modal com Esc.
  useEffect(() => {
    if (!selected) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [selected]);

  function shiftRef(delta: number) {
    setRefIso((prev) => {
      const base = prev ? new Date(prev) : new Date();
      base.setHours(0, 0, 0, 0);
      if (view === "mes") {
        base.setDate(1);
        base.setMonth(base.getMonth() + delta);
      } else if (view === "semana") {
        base.setDate(base.getDate() + 7 * delta);
      } else {
        base.setDate(base.getDate() + delta);
      }
      return base.toISOString();
    });
  }
  function toggleResult(cat: ResultCat) {
    setHiddenResults((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }
  function toggleOwner(id: string) {
    setHiddenOwners((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Enquanto não montou no cliente, não renderiza o calendário (evita usar
  // Date/window no SSR e qualquer mismatch de hidratação).
  if (!mounted) {
    return <div className="p-8 text-sm text-slate-500">Carregando agenda…</div>;
  }

  if (status === "idle" || status === "loading") {
    return (
      <>
        <PageTitle title="Agenda" />
        <div className="p-8 text-sm text-slate-500">Carregando reuniões do HubSpot…</div>
      </>
    );
  }
  if (status === "erro" || !data) {
    return (
      <>
        <PageTitle title="Agenda" />
        <div className="p-8 text-sm text-slate-600">
          Não foi possível carregar as reuniões do HubSpot.
          {err ? <div className="mt-1 text-xs text-slate-400">Detalhe: {err}</div> : null}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => load(true)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Tentar de novo
            </button>
          </div>
        </div>
      </>
    );
  }

  const meetings = data.meetings;
  const owners = data.owners;
  const colorOf = (m: Meeting) => RESULT_META[resultCat(m.outcome)].color;

  // Responsáveis presentes (para o filtro), ordem alfabética.
  const ownerIdsPresentes = [...new Set(meetings.map((m) => m.ownerId || ""))];
  const ownersLista = ownerIdsPresentes
    .map((id) => ({ id, name: id ? ownerName(id, owners) : "Sem responsável" }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  // Agrupa por dia (data local), pulando o que está oculto nos filtros.
  const porDia: Record<string, EventoDia[]> = {};
  meetings.forEach((m) => {
    if (hiddenOwners.has(m.ownerId || "")) return;
    if (hiddenResults.has(resultCat(m.outcome))) return;
    const dt = parseHubspotDate(m.start);
    if (!dt) return;
    const key = dateKey(dt);
    (porDia[key] = porDia[key] || []).push({ ...m, _dt: dt });
  });
  Object.values(porDia).forEach((list) => list.sort((a, b) => a._dt.getTime() - b._dt.getTime()));

  const ref = refIso ? new Date(refIso) : new Date();
  ref.setHours(0, 0, 0, 0);
  const hojeKey = dateKey(new Date());

  // ── Título e corpo por visão ──
  let titulo = "";
  let corpo: React.ReactNode = null;

  if (view === "mes") {
    const ano = ref.getFullYear();
    const mes = ref.getMonth();
    titulo = capitalize(ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
    const primeiro = new Date(ano, mes, 1);
    const inicioGrade = new Date(primeiro);
    inicioGrade.setDate(1 - primeiro.getDay());
    const ultimo = new Date(ano, mes + 1, 0);
    const fimGrade = new Date(ultimo);
    fimGrade.setDate(ultimo.getDate() + (6 - ultimo.getDay()));
    const dows = DOW.map((lbl, i) => ({ lbl, i })).filter((x) => weekends || (x.i !== 0 && x.i !== 6));
    const cells: React.ReactNode[] = [];
    for (let d = new Date(inicioGrade); d <= fimGrade; d.setDate(d.getDate() + 1)) {
      const dia = new Date(d);
      const g = dia.getDay();
      if (!weekends && (g === 0 || g === 6)) continue;
      const key = dateKey(dia);
      const evs = porDia[key] || [];
      const MAX = 3;
      const foraDoMes = dia.getMonth() !== mes;
      cells.push(
        <button
          type="button"
          key={key}
          onClick={() => {
            setRefIso(dia.toISOString());
            setMiniIso(null);
            setView("dia");
          }}
          className={`flex min-h-0 flex-col overflow-hidden border-b border-r border-slate-200 p-1 text-left hover:bg-slate-50 ${
            foraDoMes ? "bg-slate-50/60" : "bg-white"
          }`}
        >
          <span
            className={`mb-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
              key === hojeKey ? "bg-indigo-600 text-white" : foraDoMes ? "text-slate-400" : "text-slate-700"
            }`}
          >
            {dia.getDate()}
          </span>
          <span className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
            {evs.slice(0, MAX).map((m) => (
              <span
                key={m.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(m);
                }}
                className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] hover:bg-slate-100"
                title={horaCurta(m._dt) + " · " + (m.title || "Reunião")}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colorOf(m) }} />
                <span className="shrink-0 tabular-nums text-slate-500">{horaCurta(m._dt)}</span>
                <span className="truncate text-slate-700">{m.title || ownerName(m.ownerId, owners) || "Reunião"}</span>
              </span>
            ))}
            {evs.length > MAX ? (
              <span className="px-1 text-[11px] font-medium text-slate-400">+{evs.length - MAX} mais</span>
            ) : null}
          </span>
        </button>,
      );
    }
    corpo = (
      <div className="flex h-full min-h-0 flex-col">
        <div
          className="grid border-l border-t border-slate-200"
          style={{ gridTemplateColumns: `repeat(${dows.length}, minmax(0,1fr))` }}
        >
          {dows.map((x) => (
            <div
              key={x.i}
              className="border-b border-r border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            >
              {x.lbl}
            </div>
          ))}
        </div>
        <div
          className="grid min-h-0 flex-1 border-l border-slate-200"
          style={{ gridTemplateColumns: `repeat(${dows.length}, minmax(0,1fr))`, gridAutoRows: "minmax(0, 1fr)" }}
        >
          {cells}
        </div>
      </div>
    );
  } else {
    // Semana ou Dia: grade de horas.
    let dias: Date[] = [];
    if (view === "semana") {
      const ini = new Date(ref);
      ini.setDate(ref.getDate() - ref.getDay());
      for (let i = 0; i < 7; i++) {
        const dd = new Date(ini);
        dd.setDate(ini.getDate() + i);
        dias.push(dd);
      }
      const fim = dias[6];
      const mesmoMes = ini.getMonth() === fim.getMonth();
      titulo = mesmoMes
        ? `${ini.getDate()}–${fim.getDate()} de ${capitalize(ini.toLocaleDateString("pt-BR", { month: "long" }))} de ${ini.getFullYear()}`
        : `${ini.getDate()} ${capitalize(ini.toLocaleDateString("pt-BR", { month: "short" }))} – ${fim.getDate()} ${capitalize(fim.toLocaleDateString("pt-BR", { month: "short" }))} de ${fim.getFullYear()}`;
      if (!weekends) dias = dias.filter((dd) => dd.getDay() !== 0 && dd.getDay() !== 6);
    } else {
      dias = [new Date(ref)];
      titulo = capitalize(ref.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }));
    }
    const now = new Date();
    corpo = (
      <div className="flex h-full min-h-0 flex-col">
        {/* cabeçalho dos dias */}
        <div className="flex border-b border-slate-200 pr-2">
          <div className="w-14 shrink-0" />
          {dias.map((dia) => {
            const eHoje = dateKey(dia) === hojeKey;
            return (
              <div key={dateKey(dia)} className="flex-1 py-1 text-center">
                <div className="text-[11px] uppercase text-slate-400">{DOW[dia.getDay()]}</div>
                <div
                  className={`mx-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    eHoje ? "bg-indigo-600 text-white" : "text-slate-700"
                  }`}
                >
                  {dia.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        {/* grade rolável */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex" style={{ height: 24 * HOUR_PX }}>
            {/* eixo de horas */}
            <div className="w-14 shrink-0">
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  className="relative border-r border-slate-200 text-right"
                  style={{ height: HOUR_PX }}
                >
                  <span className="pr-1 text-[10px] text-slate-400">{String(h).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>
            {/* colunas de dia */}
            {dias.map((dia) => {
              const evs = porDia[dateKey(dia)] || [];
              const eHoje = dateKey(dia) === hojeKey;
              return (
                <div key={dateKey(dia)} className="relative flex-1 border-r border-slate-200">
                  {/* linhas de hora */}
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="border-b border-slate-100" style={{ height: HOUR_PX }} />
                  ))}
                  {/* linha do agora */}
                  {eHoje ? (
                    <div
                      className="pointer-events-none absolute left-0 right-0 border-t-2 border-rose-500"
                      style={{ top: (now.getHours() + now.getMinutes() / 60) * HOUR_PX }}
                    />
                  ) : null}
                  {/* blocos de reunião */}
                  {evs.map((m) => {
                    const ini = m._dt;
                    const topH = ini.getHours() + ini.getMinutes() / 60;
                    let durH = 0.5;
                    const fim = parseHubspotDate(m.end);
                    if (fim && fim > ini) durH = (fim.getTime() - ini.getTime()) / 3600000;
                    const preVend = m.preVendedorId ? ownerName(m.preVendedorId, owners) : "";
                    const label = (preVend ? preVend + " · " : "") + (m.title || "Reunião");
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setSelected(m)}
                        className="absolute left-0.5 right-0.5 overflow-hidden rounded px-1 py-0.5 text-left text-[11px] font-medium text-white shadow-sm"
                        style={{
                          top: topH * HOUR_PX,
                          height: Math.max(20, durH * HOUR_PX - 2),
                          background: colorOf(m),
                        }}
                        title={ini.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + " · " + label}
                      >
                        <span className="block truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Minicalendário ──
  const miniRefBase = miniIso ? new Date(miniIso) : new Date(ref);
  miniRefBase.setDate(1);
  miniRefBase.setHours(0, 0, 0, 0);
  const miniAno = miniRefBase.getFullYear();
  const miniMes = miniRefBase.getMonth();
  const selKey = dateKey(ref);
  const miniIni = new Date(miniAno, miniMes, 1);
  miniIni.setDate(1 - miniIni.getDay());
  const miniFim = new Date(miniAno, miniMes + 1, 0);
  miniFim.setDate(miniFim.getDate() + (6 - miniFim.getDay()));
  const miniCells: React.ReactNode[] = [];
  for (let d = new Date(miniIni); d <= miniFim; d.setDate(d.getDate() + 1)) {
    const dia = new Date(d);
    const key = dateKey(dia);
    const fora = dia.getMonth() !== miniMes;
    const eHoje = key === hojeKey;
    const eSel = key === selKey;
    miniCells.push(
      <button
        type="button"
        key={key}
        onClick={() => {
          setRefIso(dia.toISOString());
          setMiniIso(null);
        }}
        className={`h-7 w-7 rounded-full text-xs ${
          eSel ? "bg-indigo-600 text-white" : eHoje ? "bg-indigo-100 text-indigo-700" : fora ? "text-slate-300" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        {dia.getDate()}
      </button>,
    );
  }

  const viewBtn = (v: View, label: string) => (
    <button
      type="button"
      onClick={() => setView(v)}
      className={`rounded-md px-3 py-1 text-sm font-medium ${
        view === v ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <PageTitle title="Agenda" />

      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2">
        <button
          type="button"
          onClick={() => setRefIso(null)}
          className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Hoje
        </button>
        <button
          type="button"
          onClick={() => shiftRef(-1)}
          aria-label="Anterior"
          className="rounded-lg border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => shiftRef(1)}
          aria-label="Próximo"
          className="rounded-lg border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50"
        >
          ›
        </button>
        <div className="ml-1 text-base font-semibold text-slate-800">{titulo}</div>
        <div className="ml-auto flex items-center gap-1">
          {viewBtn("dia", "Dia")}
          {viewBtn("semana", "Semana")}
          {viewBtn("mes", "Mês")}
          <button
            type="button"
            onClick={() => load(true)}
            className="ml-2 rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50"
            title="Atualizar"
          >
            ⟳ Atualizar
          </button>
        </div>
      </div>

      {/* Layout: painel + calendário */}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-200 p-3 md:flex">
          {/* Minicalendário */}
          <div>
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-slate-700">
                {capitalize(miniRefBase.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }))}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() => {
                    const d = new Date(miniRefBase);
                    d.setMonth(d.getMonth() - 1);
                    setMiniIso(d.toISOString());
                  }}
                  className="rounded px-1 text-slate-500 hover:bg-slate-100"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  onClick={() => {
                    const d = new Date(miniRefBase);
                    d.setMonth(d.getMonth() + 1);
                    setMiniIso(d.toISOString());
                  }}
                  className="rounded px-1 text-slate-500 hover:bg-slate-100"
                >
                  ›
                </button>
              </span>
            </div>
            <div className="grid grid-cols-7 place-items-center gap-0.5">
              {DOW.map((d) => (
                <div key={d} className="text-[10px] text-slate-400">
                  {d.charAt(0)}
                </div>
              ))}
              {miniCells}
            </div>
          </div>

          {/* Filtro: Resultado */}
          <div>
            <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Resultado</div>
            <div className="flex flex-col gap-1">
              {RESULT_ORDER.map((cat) => (
                <label key={cat} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={!hiddenResults.has(cat)} onChange={() => toggleResult(cat)} />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: RESULT_META[cat].color }} />
                  <span className="text-slate-700">{RESULT_META[cat].label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Filtro: Responsáveis */}
          <div>
            <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Responsáveis</div>
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {ownersLista.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={!hiddenOwners.has(o.id)} onChange={() => toggleOwner(o.id)} />
                  <span className="truncate text-slate-700">{o.name}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 px-1 text-sm text-slate-600">
            <input type="checkbox" checked={weekends} onChange={() => setWeekends((v) => !v)} /> Mostrar fins de semana
          </label>
        </aside>

        <div className="min-w-0 flex-1 overflow-hidden">{corpo}</div>
      </div>

      {/* Modal de detalhe (read-only) */}
      {selected ? (
        <MeetingModal meeting={selected} owners={owners} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}

function Campo({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-sm ${value ? "text-slate-800" : "text-slate-400"}`}>
        {value || "—"}
        {value ? extra : null}
      </div>
    </div>
  );
}

function MeetingModal({
  meeting,
  owners,
  onClose,
}: {
  meeting: Meeting;
  owners: Record<string, string>;
  onClose: () => void;
}) {
  const dt = parseHubspotDate(meeting.start);
  const fim = parseHubspotDate(meeting.end);
  const quando = dt
    ? capitalize(dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })) +
      " · " +
      dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) +
      (fim ? " às " + fim.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "")
    : "—";
  const criada = parseHubspotDate(meeting.createdate);
  const preVend = meeting.preVendedorId ? ownerName(meeting.preVendedorId, owners) : "";
  const vendedor = meeting.dealOwnerId ? ownerName(meeting.dealOwnerId, owners) : "";
  const meta = RESULT_META[resultCat(meeting.outcome)];
  const corpo = htmlToText(meeting.body);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-800">{meeting.title || "Reunião"}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <div className="mb-4 text-sm text-slate-500">{quando}</div>

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Contato" value={meeting.contactName} />
          <Campo
            label="Negócio relacionado"
            value={meeting.dealName}
            extra={
              meeting.dealId ? (
                <>
                  {" · "}
                  <a
                    href={hubspotDealUrl(meeting.dealId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    HubSpot ↗
                  </a>
                </>
              ) : null
            }
          />
          <Campo label="Pré-vendedor (agendou)" value={preVend} />
          <Campo label="Vendedor (responsável pela venda)" value={vendedor} />
          <Campo label="Tipo da reunião" value={meeting.type} />
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Resultado da reunião</div>
            <div className="mt-1 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: meta.color }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
              {outcomeLabel(meeting.outcome)}
            </div>
          </div>
          <Campo label="Agendada em" value={criada ? fmtDataHora(criada) : ""} />
        </div>

        {corpo ? (
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Descrição</div>
            <div className="whitespace-pre-wrap text-sm text-slate-600">{corpo}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
