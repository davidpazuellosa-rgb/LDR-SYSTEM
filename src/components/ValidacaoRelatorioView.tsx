import HorariosView from "@/components/HorariosView";
import type { RelatorioValidacao } from "@/lib/relatorio-validacao";

const CARD = "rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm";
const TITLE = "text-[13px] font-semibold text-slate-700";
const SUB = "text-[11px] text-slate-400";
const nf = (n: number) => n.toLocaleString("pt-BR");

function Var({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0) return <span className="text-[11px] text-slate-400">{cur > 0 ? "novo no período" : "—"}</span>;
  const d = Math.round(((cur - prev) / prev) * 100);
  return (
    <span className={`text-[11px] font-medium ${d >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
      {d >= 0 ? "↑" : "↓"} {Math.abs(d)}% <span className="font-normal text-slate-400">vs. anterior</span>
    </span>
  );
}

export default function ValidacaoRelatorioView({ d }: { d: RelatorioValidacao }) {
  const r = d.resumo;
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={CARD}><div className="text-2xl font-semibold tabular-nums text-slate-900">{nf(r.total)}</div><div className="mt-0.5 text-xs text-slate-500">{d.admin ? "Contatos validados no período" : "Contatos que você validou"}</div><div className="mt-1"><Var cur={r.total} prev={r.totalAnterior} /></div></div>
        <div className={CARD}><div className="text-2xl font-semibold tabular-nums text-emerald-600">{nf(r.sim)}</div><div className="mt-0.5 text-xs text-slate-500">Sim</div></div>
        <div className={CARD}><div className="text-2xl font-semibold tabular-nums text-red-500">{nf(r.nao)}</div><div className="mt-0.5 text-xs text-slate-500">Não</div></div>
        <div className={CARD}><div className="text-2xl font-semibold tabular-nums text-slate-900">{r.taxa === null ? "—" : `${r.taxa}%`}</div><div className="mt-0.5 text-xs text-slate-500">Taxa de acerto (Sim sobre Sim + Não)</div></div>
      </section>

      <section className={`${CARD} overflow-x-auto !p-0`}>
        <div className="px-4 pt-4">
          <h2 className={TITLE}>Por planilha</h2>
          <p className={`mb-3 ${SUB}`}>Situação atual de cada planilha com validação ligada{d.admin ? "" : " · “no período” é só o que você validou"}</p>
        </div>
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Planilha</th>
              <th className="px-3 py-2 text-right font-medium">Contatos</th>
              <th className="px-3 py-2 text-right font-medium">Sim</th>
              <th className="px-3 py-2 text-right font-medium">Não</th>
              <th className="px-3 py-2 text-right font-medium">A validar</th>
              <th className="px-3 py-2 font-medium">% validada</th>
              <th className="px-3 py-2 text-right font-medium">No período</th>
              {d.admin && <th className="px-3 py-2 font-medium">Quem mais validou</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {d.planilhas.length === 0 && <tr><td colSpan={d.admin ? 8 : 7} className="px-4 py-8 text-center text-slate-400">Nenhuma planilha com validação ligada.</td></tr>}
            {d.planilhas.map((p) => (
              <tr key={p.baseId} className="hover:bg-slate-50/60">
                <td className="px-4 py-2 font-medium text-slate-700">{p.nome}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{nf(p.total)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{nf(p.sim)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-600">{nf(p.nao)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">{nf(p.aValidar)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-500" style={{ width: `${p.pctValidada}%` }} /></div>
                    <span className="text-xs tabular-nums text-slate-500">{p.pctValidada}%</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{nf(p.noPeriodo.sim)} Sim · {nf(p.noPeriodo.nao)} Não</td>
                {d.admin && <td className="px-3 py-2 text-slate-600">{p.top ? `${p.top.nome} (${nf(p.top.n)})` : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {d.admin && d.pessoas && (
        <section className={`${CARD} overflow-x-auto !p-0`}>
          <div className="px-4 pt-4">
            <h2 className={TITLE}>Por pessoa</h2>
            <p className={`mb-3 ${SUB}`}>Quem registrou Sim ou Não no período</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Pessoa</th>
                <th className="px-3 py-2 text-right font-medium">Validados</th>
                <th className="px-3 py-2 text-right font-medium">Sim</th>
                <th className="px-3 py-2 text-right font-medium">Não</th>
                <th className="px-3 py-2 text-right font-medium">Acerto</th>
                <th className="px-3 py-2 text-right font-medium">Planilhas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {d.pessoas.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhuma validação no período.</td></tr>}
              {d.pessoas.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium text-slate-700">{p.nome}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">{nf(p.total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{nf(p.sim)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600">{nf(p.nao)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{p.taxa === null ? "—" : `${p.taxa}%`}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{p.planilhas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className={CARD}>
        <h2 className={TITLE}>{d.admin ? "Horários em que a equipe mais valida" : "Os seus horários de validação"}</h2>
        <p className={`mb-4 ${SUB}`}>Horário de Brasília · hora em que o Sim/Não foi registrado</p>
        <HorariosView h={d.horarios} compacto />
      </section>
    </div>
  );
}
