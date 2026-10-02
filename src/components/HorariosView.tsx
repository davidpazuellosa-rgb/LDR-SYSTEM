import type { Horarios } from "@/lib/horarios";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const TURNOS = [
  { k: "madrugada", label: "Madrugada", faixa: "00–06h" },
  { k: "manha", label: "Manhã", faixa: "06–12h" },
  { k: "tarde", label: "Tarde", faixa: "12–18h" },
  { k: "noite", label: "Noite", faixa: "18–24h" },
] as const;

// Horários de produção: frases, curva por hora, mapa de calor dia × hora e turnos.
// Sem estado — funciona em Server e Client Components.
export default function HorariosView({ h, compacto = false }: { h: Horarios; compacto?: boolean }) {
  if (h.total === 0) return <p className="py-8 text-center text-xs text-slate-400">{h.frases[0]}</p>;
  const maxHora = Math.max(1, ...h.porHora);
  return (
    <div className="space-y-5">
      <ul className="space-y-1">
        {h.frases.map((f, i) => (
          <li key={i} className={`flex items-start gap-2 text-sm ${i === 0 ? "font-medium text-slate-800" : "text-slate-600"}`}>
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
            {f}
          </li>
        ))}
      </ul>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-slate-500">Produção por hora do dia</p>
        <div className="flex h-24 items-end gap-[3px]">
          {h.porHora.map((v, hora) => {
            const na = h.melhorJanela && (hora === h.melhorJanela.de || hora === (h.melhorJanela.de + 1) % 24);
            return (
              <div key={hora} className="flex h-full flex-1 flex-col justify-end" title={`${String(hora).padStart(2, "0")}h: ${v}`}>
                <div className={`w-full rounded-t ${na ? "bg-indigo-600" : "bg-indigo-300"}`} style={{ height: `${v ? Math.max(4, (v / maxHora) * 100) : 1}%`, opacity: v ? 1 : 0.25 }} />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-[3px] text-[10px] text-slate-400">
          {h.porHora.map((_, hora) => (
            <span key={hora} className="relative h-3 flex-1">
              {hora % 3 === 0 && <span className="absolute left-1/2 -translate-x-1/2">{hora}h</span>}
            </span>
          ))}
        </div>
      </div>

      <div className={`grid gap-2 ${compacto ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        {TURNOS.map((t) => {
          const v = h.turnos[t.k];
          return (
            <div key={t.k} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[11px] text-slate-500">{t.label} <span className="text-slate-400">{t.faixa}</span></div>
              <div className="text-lg font-semibold tabular-nums text-slate-800">{v}</div>
              <div className="text-[10px] text-slate-400">{Math.round((v / h.total) * 100)}%</div>
            </div>
          );
        })}
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-slate-500">Mapa de calor · dia da semana × hora</p>
        <div className="space-y-[3px]">
          <div className="flex items-center gap-[2px] pl-8 text-[9px] text-slate-400">
            {Array.from({ length: 24 }, (_, hora) => <span key={hora} className="flex-1 text-center">{hora % 6 === 0 ? `${hora}h` : ""}</span>)}
          </div>
          {h.mapa.map((linha, d) => (
            <div key={d} className="flex items-center gap-[2px]">
              <span className="w-8 shrink-0 text-[10px] font-medium text-slate-400">{DIAS[d]}</span>
              {linha.map((v, hora) => (
                <span
                  key={hora}
                  title={`${DIAS[d]} ${String(hora).padStart(2, "0")}h — ${v}`}
                  className="aspect-square flex-1 rounded-[2px]"
                  style={{ backgroundColor: v ? `rgba(99,102,241,${(0.15 + 0.85 * (v / h.pico)).toFixed(3)})` : "#f1f5f9" }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
