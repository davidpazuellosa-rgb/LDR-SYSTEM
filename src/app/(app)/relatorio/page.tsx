import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { currentRole } from "@/lib/current-role";
import { getProprietarioDoUsuario } from "@/lib/user-proprietario";
import PageHeader from "@/components/PageHeader";
import RelatorioOperador, { type RelatorioRow } from "@/components/RelatorioOperador";
import HorariosView from "@/components/HorariosView";
import { AbasLinks, PeriodoLinks, MeuDesempenho, RankingTabela, type Aba } from "@/components/MeuRelatorio";
import { buildMeuRelatorio, buildRanking } from "@/lib/producao";
import { parsePreset } from "@/lib/producao-calc";

export const dynamic = "force-dynamic";

// Relatório do próprio operador (LDR / Pré-vendedor): só os dados DELE.
export default async function RelatorioPage({ searchParams }: { searchParams: Promise<{ aba?: string; periodo?: string }> }) {
  const sp = await searchParams;
  const aba: Aba = (["desempenho", "horarios", "ranking", "correcoes"] as const).find((a) => a === sp.aba) ?? "desempenho";
  const periodo = parsePreset(sp.periodo === "personalizado" ? undefined : sp.periodo);
  const session = await auth();
  if (!session?.user) redirect("/login");
  const meId = (session.user as { id?: string }).id || "";
  const role = await currentRole(session);

  // Abas novas (SEGURANÇA: o usuário vem SEMPRE da sessão — nada da URL escolhe pessoa).
  if (aba !== "correcoes") {
    const periodoQ = { periodo };
    const ranking = aba === "ranking" ? await buildRanking(periodoQ) : null;
    const meu = aba === "ranking" ? null : await buildMeuRelatorio(meId, periodoQ);
    return (
      <>
        <PageHeader title="Relatório" />
        <div className="space-y-5 p-8">
          <AbasLinks ativa={aba} periodo={periodo} />
          <PeriodoLinks aba={aba} periodo={periodo} />
          {ranking && <RankingTabela linhas={ranking} meId={meId} />}
          {aba === "desempenho" && meu && <MeuDesempenho d={meu} />}
          {aba === "horarios" && meu && (
            <section className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <h2 className="mb-1 text-[13px] font-semibold text-slate-700">Em que horários você mais produz</h2>
              <p className="mb-4 text-[11px] text-slate-400">Horário de Brasília · conta quando a linha ficou completa ou a correção foi resolvida</p>
              <HorariosView h={meu.horarios} />
            </section>
          )}
        </div>
      </>
    );
  }

  // Pré-vendedor: a "fila" do card é a do proprietário dele, não a geral.
  const proprietario = role === "prevendedor" ? await getProprietarioDoUsuario(meId) : null;

  const [rows, filaGlobal] = await Promise.all([
    prisma.correction.findMany({
      where: { resolvedById: meId, status: { in: ["resolved", "nao_encontrado"] } },
      select: {
        status: true,
        oldValue: true,
        newValue: true,
        resolvedAt: true,
        contact: { select: { cidade: true, estado: true, campanha: true, regiao: true } },
      },
      orderBy: { resolvedAt: "desc" },
      take: 5000,
    }),
    prisma.correction.count({
      where: { status: "pending", ...(proprietario ? { contact: { is: { proprietario } } } : {}) },
    }),
  ]);

  const data: RelatorioRow[] = rows.map((r) => ({
    status: r.status,
    oldValue: r.oldValue,
    newValue: r.newValue,
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    cidade: r.contact.cidade,
    estado: r.contact.estado,
    campanha: r.contact.campanha,
    regiao: r.contact.regiao,
  }));

  return (
    <>
      <PageHeader title="Relatório" />
      <div className="space-y-5 p-8">
        <AbasLinks ativa="correcoes" periodo={periodo} />
        <RelatorioOperador rows={data} filaGlobal={filaGlobal} />
      </div>
    </>
  );
}
