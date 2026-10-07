import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { currentRole } from "@/lib/current-role";
import { isAdmin } from "@/lib/permissions";
import { buildProducao, buildMeuRelatorio } from "@/lib/producao";
import { parsePreset } from "@/lib/producao-calc";
import PageHeader from "@/components/PageHeader";
import RelatoriosTabs from "@/components/RelatoriosTabs";
import RelatoriosFiltroSimples from "@/components/RelatoriosFiltroSimples";
import PeriodoLinks from "@/components/PeriodoLinks";
import HorariosView from "@/components/HorariosView";

export const dynamic = "force-dynamic";

const CARD = "rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm";

// Horários de produção. Admin: equipe toda ou "ver de quem". LDR/Pré-vendedor: só os dele
// (a pessoa vem SEMPRE da sessão — `pessoa` na URL é ignorado para quem não é admin).
export default async function HorariosPage({ searchParams }: { searchParams: Promise<{ periodo?: string; de?: string; ate?: string; pessoa?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const meId = (session.user as { id?: string }).id || "";
  const admin = isAdmin(await currentRole(session));
  const sp = await searchParams;

  if (!admin) {
    const periodo = parsePreset(sp.periodo === "personalizado" ? undefined : sp.periodo);
    const meu = await buildMeuRelatorio(meId, { periodo });
    return (
      <>
        <PageHeader title="Relatórios" />
        <main className="mx-auto max-w-[1400px] space-y-5 p-6">
          <RelatoriosTabs ativa="horarios" admin={false} />
          <PeriodoLinks base="/relatorios/horarios" periodo={periodo} />
          <section className={CARD}>
            <h2 className="mb-1 text-[13px] font-semibold text-slate-700">Em que horários você mais produz</h2>
            <p className="mb-4 text-[11px] text-slate-400">Horário de Brasília · conta quando a linha ficou completa ou a correção foi resolvida</p>
            <HorariosView h={meu.horarios} />
          </section>
        </main>
      </>
    );
  }

  const d = await buildProducao({ periodo: sp.periodo, de: sp.de, ate: sp.ate, pessoas: sp.pessoa || undefined });
  const h = sp.pessoa ? d.horariosPorPessoa[sp.pessoa] ?? d.horarios : d.horarios;
  const quem = sp.pessoa ? d.opcoes.pessoas.find((p) => p.id === sp.pessoa)?.nome || "pessoa escolhida" : "toda a equipe";
  return (
    <>
      <PageHeader title="Relatórios" />
      <main className="mx-auto max-w-[1400px] space-y-5 p-6">
        <RelatoriosTabs ativa="horarios" admin />
        <RelatoriosFiltroSimples base="/relatorios/horarios" preset={d.preset} de={d.de} ate={d.ate} pessoa={sp.pessoa || null} pessoas={d.opcoes.pessoas} />
        <section className={CARD}>
          <h2 className="mb-1 text-[13px] font-semibold text-slate-700">Em que horários produz: {quem}</h2>
          <p className="mb-4 text-[11px] text-slate-400">Horário de Brasília · conta quando a linha ficou completa ou a correção foi resolvida</p>
          <HorariosView h={h} />
        </section>
      </main>
    </>
  );
}
