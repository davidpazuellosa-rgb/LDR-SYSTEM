import { auth } from "@/auth";
import { buildMinhasMetas } from "@/lib/minhas-metas";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

const CARD = "rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm";
const TITLE = "text-[13px] font-semibold text-slate-700";
const SUB = "text-[11px] text-slate-400";

const STATUS = {
  ok: { label: "No ritmo", chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" },
  risco: { label: "Em risco", chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500" },
  atrasado: { label: "Atrasado", chip: "bg-rose-50 text-rose-600", bar: "bg-rose-500" },
} as const;

const prazoLabel = (p: string) => (p === "mensal" ? "este mês" : "esta semana");

function Bullet({ a }: { a: Awaited<ReturnType<typeof buildMinhasMetas>>["ativas"][number] }) {
  const s = STATUS[a.status];
  const esperadoPct = a.alvo > 0 ? Math.min(100, (a.esperado / a.alvo) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <span className="min-w-0 truncate text-slate-600">{a.rotulo}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="tabular-nums text-slate-400">{a.feito}/{a.alvo} · {a.p}%</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${s.chip}`}>{s.label}</span>
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.max(2, a.p)}%` }} />
        <span className="absolute top-0 h-full w-px bg-slate-400" style={{ left: `${esperadoPct}%` }} title={`Ritmo esperado: ${a.esperado}`} />
      </div>
    </div>
  );
}

export default async function MinhasMetasPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id || "";
  const { ativas, historico, conquistas } = await buildMinhasMetas(userId);

  const fill = ativas.filter((a) => a.tipo !== "correcao");
  const corr = ativas.filter((a) => a.tipo === "correcao");
  const semMetas = ativas.length === 0 && historico.length === 0;

  return (
    <>
      <PageHeader title="Minhas Metas" />
      <main className="mx-auto max-w-[1100px] space-y-5 p-6">
        {semMetas ? (
          <div className={`${CARD} py-10 text-center`}>
            <p className="text-sm text-slate-500">Você ainda não tem metas definidas.</p>
            <p className="mt-1 text-xs text-slate-400">O administrador define as metas em Usuários → Meta.</p>
          </div>
        ) : (
          <>
            {/* Conquistas */}
            <section className="grid grid-cols-3 gap-3">
              <div className={CARD}>
                <div className="text-2xl font-semibold tabular-nums text-slate-900">
                  {conquistas.batendoAgora}<span className="text-base text-slate-400">/{conquistas.totalAtivas}</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">Metas batidas agora</div>
              </div>
              <div className={CARD}>
                <div className="flex items-center gap-1.5 text-2xl font-semibold tabular-nums text-slate-900">
                  {conquistas.melhorSequencia > 0 && <span className="text-lg">🔥</span>}
                  {conquistas.melhorSequencia}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">Melhor sequência (períodos seguidos)</div>
              </div>
              <div className={CARD}>
                <div className="text-2xl font-semibold tabular-nums text-slate-900">{conquistas.batidasHistorico}</div>
                <div className="mt-0.5 text-xs text-slate-500">Metas batidas no histórico</div>
              </div>
            </section>

            {/* Metas ativas */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className={CARD}>
                <h2 className={TITLE}>Preenchimento</h2>
                <p className={`mb-3 ${SUB}`}>Prefeituras completas no período</p>
                {fill.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">Sem meta de preenchimento.</p>
                ) : (
                  <div className="space-y-3">
                    {fill.map((a) => (
                      <div key={a.id}>
                        <Bullet a={a} />
                        <div className="mt-0.5 text-[10px] text-slate-400">{prazoLabel(a.prazo)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={CARD}>
                <h2 className={TITLE}>Correção</h2>
                <p className={`mb-3 ${SUB}`}>Contatos corrigidos no período</p>
                {corr.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">Sem meta de correção.</p>
                ) : (
                  <div className="space-y-3">
                    {corr.map((a) => (
                      <div key={a.id}>
                        <Bullet a={a} />
                        <div className="mt-0.5 text-[10px] text-slate-400">{prazoLabel(a.prazo)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Histórico */}
            <section className={CARD}>
              <h2 className={TITLE}>Histórico</h2>
              <p className={`mb-3 ${SUB}`}>Períodos anteriores · verde = meta batida</p>
              <div className="space-y-4">
                {historico.map((h) => (
                  <div key={h.id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate text-slate-600">{h.rotulo}</span>
                      {h.streak > 0 && <span className="shrink-0 text-[10px] text-amber-600">🔥 {h.streak} seguidas</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {h.periodos.map((p, i) => (
                        <div
                          key={i}
                          title={`${p.label}: ${p.feito}/${p.alvo}`}
                          className={`flex min-w-[54px] flex-col items-center rounded-md border px-2 py-1 ${
                            p.hit ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <span className="text-[10px] text-slate-400">{p.label}</span>
                          <span className={`text-xs font-semibold tabular-nums ${p.hit ? "text-emerald-700" : "text-slate-500"}`}>
                            {p.feito}/{p.alvo}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
