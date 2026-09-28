import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/permissions";
import { buildProducao, type ParamsProducao } from "@/lib/producao";
import PageHeader from "@/components/PageHeader";
import RelatoriosTabs from "@/components/RelatoriosTabs";
import ProducaoFiltros from "@/components/ProducaoFiltros";
import ProducaoView from "@/components/ProducaoView";

export const dynamic = "force-dynamic";

export default async function ProducaoPage({ searchParams }: { searchParams: Promise<ParamsProducao> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdmin(role)) redirect("/dashboard");

  const sp = await searchParams;
  const data = await buildProducao(sp);
  const query = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]).toString();

  const fmt = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10).split("-").reverse().join("/");
  const ultimo = fmt(new Date(new Date(data.faixa.ate).getTime() - 1).toISOString());

  return (
    <>
      <PageHeader title="Relatórios" />
      <main className="mx-auto max-w-[1400px] space-y-5 p-6">
        <RelatoriosTabs ativa="producao" />
        <ProducaoFiltros preset={data.preset} de={data.de} ate={data.ate} filtros={data.filtros} opcoes={data.opcoes} />
        <p className="text-xs text-slate-400">
          Período: {fmt(data.faixa.de)} a {ultimo}. Preenchimento conta o território da meta; correção conta quem resolveu.
        </p>
        <ProducaoView data={data} query={query} />
      </main>
    </>
  );
}
