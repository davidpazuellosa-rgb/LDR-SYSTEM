import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { currentRole } from "@/lib/current-role";
import { isAdmin } from "@/lib/permissions";
import { buildRelatorioValidacao, type ParamsValidacao } from "@/lib/relatorio-validacao";
import { parsePreset } from "@/lib/producao-calc";
import PageHeader from "@/components/PageHeader";
import RelatoriosTabs from "@/components/RelatoriosTabs";
import RelatoriosFiltroSimples from "@/components/RelatoriosFiltroSimples";
import PeriodoLinks from "@/components/PeriodoLinks";
import ValidacaoRelatorioView from "@/components/ValidacaoRelatorioView";

export const dynamic = "force-dynamic";

// Validação: admin = equipe e planilhas; LDR/Pré-vendedor = só as validações dele.
export default async function ValidacaoPage({ searchParams }: { searchParams: Promise<ParamsValidacao> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const meId = (session.user as { id?: string }).id || "";
  const admin = isAdmin(await currentRole(session));
  const sp = await searchParams;
  const d = await buildRelatorioValidacao(admin ? sp : { periodo: sp.periodo === "personalizado" ? undefined : sp.periodo }, { id: meId, admin });
  return (
    <>
      <PageHeader title="Relatórios" />
      <main className="mx-auto max-w-[1400px] space-y-5 p-6">
        <RelatoriosTabs ativa="validacao" admin={admin} />
        {admin
          ? <RelatoriosFiltroSimples base="/relatorios/validacao" preset={d.preset} de={d.de} ate={d.ate} pessoa={null} />
          : <PeriodoLinks base="/relatorios/validacao" periodo={parsePreset(sp.periodo === "personalizado" ? undefined : sp.periodo)} />}
        <ValidacaoRelatorioView d={d} />
      </main>
    </>
  );
}
