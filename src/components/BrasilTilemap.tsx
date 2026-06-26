// Mapa do Brasil em "tilegram" (grade de quadradinhos por UF, posicionados de forma
// aproximada à geografia). Leve e sem dependência — cor por taxa de atualização.
type UFDado = { total: number; incorreto: number; atualizado: number; taxa: number | null };

// Posição de cada UF na grade (linha, coluna) — base 1 para CSS grid.
const POS: Record<string, [number, number]> = {
  RR: [1, 3], AP: [1, 4],
  AM: [2, 2], PA: [2, 4], MA: [2, 5], CE: [2, 6], RN: [2, 7],
  TO: [3, 4], PI: [3, 5], PB: [3, 7],
  AC: [4, 1], RO: [4, 2], MT: [4, 3], BA: [4, 5], PE: [4, 7],
  MS: [5, 3], GO: [5, 4], DF: [5, 5], SE: [5, 6], AL: [5, 7],
  MG: [6, 5], ES: [6, 6],
  SP: [7, 4], RJ: [7, 5],
  PR: [8, 4],
  SC: [9, 4],
  RS: [10, 4],
};

function corDaTaxa(d: UFDado | undefined): string {
  if (!d) return "bg-slate-100 text-slate-300";
  if (d.taxa === null) return "bg-slate-200 text-slate-500"; // tem contatos, nada sinalizado
  if (d.taxa >= 80) return "bg-emerald-500 text-white";
  if (d.taxa >= 50) return "bg-amber-400 text-white";
  return "bg-red-500 text-white";
}

export default function BrasilTilemap({ dados }: { dados: Record<string, UFDado> }) {
  return (
    <div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gridTemplateRows: "repeat(10, 1fr)" }}
      >
        {Object.entries(POS).map(([uf, [row, col]]) => {
          const d = dados[uf];
          const title = d
            ? `${uf} · ${d.total} contatos · ${d.incorreto} incorretos · ${d.atualizado} atualizados${d.taxa !== null ? ` · ${d.taxa}% atualizados` : ""}`
            : `${uf} · sem contatos`;
          return (
            <div
              key={uf}
              title={title}
              style={{ gridRow: row, gridColumn: col }}
              className={`flex aspect-square flex-col items-center justify-center rounded-md text-[10px] font-bold leading-none ${corDaTaxa(d)}`}
            >
              {uf}
              {d?.taxa !== null && d?.taxa !== undefined && <span className="mt-0.5 text-[8px] font-medium opacity-90">{d.taxa}%</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-red-500" /> &lt;50% atualizados</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-400" /> 50–79%</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-500" /> ≥80%</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-slate-200" /> sem sinalização</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-slate-100" /> sem contatos</span>
      </div>
    </div>
  );
}
