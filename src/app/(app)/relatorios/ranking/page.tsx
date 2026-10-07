import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { currentRole } from "@/lib/current-role";
import { buildRankings, type ParamsRanking } from "@/lib/ranking";
import PageHeader from "@/components/PageHeader";
import RelatoriosTabs from "@/components/RelatoriosTabs";
import RankingFiltros from "@/components/RankingFiltros";
import RankingView from "@/components/RankingView";
import ExportColunasButton from "@/components/ExportColunasButton";
import { EXPORT_COLS } from "@/lib/export-cols";

export const dynamic = "force-dynamic";

// Ranking da equipe (atividades, preenchimento e validação) — visível para todos os cargos.
export default async function RankingPage({ searchParams }: { searchParams: Promise<ParamsRanking> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const meId = (session.user as { id?: string }).id || "";
  const role = await currentRole(session);
  const sp = await searchParams;
  const data = await buildRankings(sp, { id: meId, admin: role === "admin" });
  const query = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]).toString();

  const fmt = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10).split("-").reverse().join("/");
  const ultimo = fmt(new Date(new Date(data.faixa.ate).getTime() - 1).toISOString());

  return (
    <>
      <PageHeader title="Relatórios" />
      <main className="mx-auto max-w-[1400px] space-y-5 p-6">
        <RelatoriosTabs ativa="ranking" admin={role === "admin"} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <RankingFiltros preset={data.preset} de={data.de} ate={data.ate} orgao={data.orgao} soSim={data.soSim} orgaos={data.orgaos} />
          <ExportColunasButton href={`/api/ranking/export${query ? `?${query}` : ""}`} colunas={EXPORT_COLS.ranking} titulo="Exportar ranking" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Exportar
          </ExportColunasButton>
        </div>
        <p className="text-xs text-slate-400">
          Período: {fmt(data.faixa.de)} a {ultimo}. Validação conta quem registrou por último; valores antigos sem pessoa registrada não entram.
        </p>
        <RankingView data={data} meId={meId} />
      </main>
    </>
  );
}
