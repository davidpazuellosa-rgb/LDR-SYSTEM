import HorariosView from "@/components/HorariosView";
import { ranquear, variacaoPct, type LinhaRank, type Metrica } from "@/lib/ranking-calc";
import type { Rankings } from "@/lib/ranking";

const CARD = "rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm";
const TITLE = "text-[13px] font-semibold text-slate-700";
const SUB = "text-[11px] text-slate-400";
const nf = (n: number) => n.toLocaleString("pt-BR");
const MEDALHA = ["bg-amber-100 text-amber-700", "bg-slate-200 text-slate-600", "bg-orange-100 text-orange-700"];

function Posicao({ n, ativo }: { n: number; ativo: boolean }) {
  return (
    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums ${ativo && n <= 3 ? MEDALHA[n - 1] : "text-slate-400"}`}>{n}</span>
  );
}

function Var({ v }: { v: number | null }) {
  if (v === null) return null;
  return <span className={`ml-1.5 text-[11px] font-medium ${v >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{v >= 0 ? "↑" : "↓"}{Math.abs(v)}%</span>;
}

function Quadro({
  titulo, sub, linhas, metrica, meId, detalhe, sufixo = "",
}: {
  titulo: string; sub: string; linhas: LinhaRank[]; metrica: Metrica; meId: string;
  detalhe: (l: LinhaRank) => React.ReactNode; sufixo?: string;
}) {
  // Ranking por % da meta: só entra quem tem meta no período.
  const r = ranquear(metrica === "pctMeta" ? linhas.filter((l) => l.pctMeta !== null && l.pctMeta !== undefined) : linhas, metrica).map((l, i) => ({ ...l, posicao: i + 1 }));
  const max = Math.max(1, ...r.map((l) => l.valor));
  const eu = r.find((l) => l.id === meId);
  return (
    <section className={CARD}>
      <h2 className={TITLE}>{titulo}</h2>
      <p className={`mb-3 ${SUB}`}>{sub}{eu ? ` · você está em ${eu.posicao}º` : ""}</p>
      {r.length === 0 ? <p className="py-6 text-center text-xs text-slate-400">Sem dados no período.</p> : (
        <div className="divide-y divide-slate-50">
          {r.map((l) => {
            const eh = l.id === meId;
            return (
              <div key={l.id} className={`px-2 py-2 ${eh ? "rounded-lg bg-indigo-50/70" : ""}`}>
                <div className="flex items-center gap-2">
                  <Posicao n={l.posicao} ativo={l.valor > 0} />
                  <span className={`min-w-0 flex-1 truncate text-sm ${eh ? "font-semibold text-indigo-700" : "text-slate-700"}`}>{l.nome}{eh ? " (você)" : ""}</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-800">{nf(l.valor)}{sufixo}{metrica !== "pctMeta" && <Var v={variacaoPct(l.valor, l.ant?.[metrica])} />}</span>
                </div>
                <div className="ml-8 mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${eh ? "bg-indigo-600" : "bg-indigo-300"}`} style={{ width: `${l.valor > 0 ? Math.max(2, (l.valor / max) * 100) : 0}%` }} />
                </div>
                <div className="ml-8 mt-1 text-[11px] text-slate-400">{detalhe(l)}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function RankingView({ data, meId }: { data: Rankings; meId: string }) {
  const { linhas, soSim } = data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        <Quadro
          titulo="Atividades" sub={`Preenchidas + corrigidas + validadas${soSim ? " (só Sim)" : ""}`} linhas={linhas} metrica="atividades" meId={meId}
          detalhe={(l) => `${nf(l.preenchidas)} preench. · ${nf(l.corrigidas)} corrig. · ${nf(l.validadas)} valid.`}
        />
        <Quadro
          titulo="Preenchimento" sub="Linhas completas no período" linhas={linhas} metrica="preenchidas" meId={meId}
          detalhe={(l) => `${nf(l.preenchidas)} linhas completas`}
        />
        <Quadro
          titulo="Validação" sub={soSim ? "Contatos validados com Sim" : "Contatos validados por ligação (Sim + Não)"} linhas={linhas} metrica="validadas" meId={meId}
          detalhe={(l) => (l.oculto ? `${nf(l.validadas)} validações` : l.taxa === null ? "Nenhuma validação" : `${nf(l.sim)} Sim · ${nf(l.nao)} Não · acerto ${l.taxa}%`)}
        />
        <Quadro
          titulo="% da meta" sub="Quem mais bateu a própria meta no período (quem não tem meta fica de fora)" linhas={linhas} metrica="pctMeta" meId={meId} sufixo="%"
          detalhe={(l) => (l.pctMeta !== null && l.pctMeta !== undefined && l.pctMeta >= 100 ? "Meta batida" : "Em andamento")}
        />
      </div>

      <section className={CARD}>
        <h2 className={TITLE}>Validação da equipe</h2>
        <p className={`mb-3 ${SUB}`}>
          {data.equipe.sim + data.equipe.nao === 0
            ? "Nenhuma validação no período."
            : `${nf(data.equipe.sim)} Sim · ${nf(data.equipe.nao)} Não · taxa de acerto da equipe ${data.equipe.taxa}%`}
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className={CARD}>
          <h2 className={TITLE}>Horários em que a equipe mais valida</h2>
          <p className={`mb-4 ${SUB}`}>Horário de Brasília · hora em que o Sim/Não foi registrado</p>
          <HorariosView h={data.horariosEquipe} compacto />
        </section>
        <section className={CARD}>
          <h2 className={TITLE}>Os seus horários de validação</h2>
          <p className={`mb-4 ${SUB}`}>Só as suas validações</p>
          <HorariosView h={data.horariosMeus} compacto />
        </section>
      </div>
    </div>
  );
}
