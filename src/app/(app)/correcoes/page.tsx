import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { currentRole } from "@/lib/current-role";
import { getProprietarioDoUsuario } from "@/lib/user-proprietario";
import PageHeader from "@/components/PageHeader";
import CorrectionsList from "@/components/CorrectionsList";
import CrmSync from "@/components/CrmSync";
import { isCampanhaAtiva } from "@/lib/campanhas";
import { SEM_CAMPANHA } from "@/components/CorrectionsList";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CorrecoesPage({ searchParams }: { searchParams: Promise<{ sem?: string }> }) {
  const modoSem = (await searchParams).sem === "1";
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  const prevendedor = (await currentRole(session)) === "prevendedor";

  // Pré-vendedor: só vê a fila do PROPRIETÁRIO vinculado a ele. Sem vínculo → nada.
  const proprietario = prevendedor ? await getProprietarioDoUsuario(u?.id || "") : null;
  const semVinculo = prevendedor && !proprietario;

  // Só campanhas ATIVAS aparecem nesta tela (CorrectionsList ignora o resto). Antes o
  // servidor mandava TODAS as ~8.900 pendências (≈5 MB por carregamento), das quais
  // ~8.000 nunca eram exibidas (sem campanha ou de campanha inativa). Agora só vai o
  // que aparece, e só os campos que a tela usa.
  let pending: {
    id: string;
    oldValue: string | null;
    reason: string | null;
    contact: { id: string; cidade: string | null; estado: string | null; nomePrefeito: string | null; campanha: string | null; regiao: string | null; proprietario: string | null };
  }[] = [];
  const ondeSem = { OR: [{ campanha: null }, { campanha: "" }, { campanha: "-" }] };
  const escopoProp = proprietario ? { proprietario } : {};
  let semCampanha = 0;
  if (!semVinculo && modoSem) {
    // Grupo "Sem campanha": carregado só sob demanda (são milhares).
    const rows = await prisma.correction.findMany({
      where: { status: "pending", contact: { is: { ...ondeSem, ...escopoProp } } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, oldValue: true, reason: true,
        contact: { select: { id: true, cidade: true, estado: true, nomePrefeito: true, campanha: true, regiao: true, proprietario: true } },
      },
    });
    pending = rows.map((r) => ({ ...r, contact: { ...r.contact, campanha: SEM_CAMPANHA, regiao: r.contact.regiao?.trim() || "Sem região" } }));
    semCampanha = pending.length;
  } else if (!semVinculo) {
    semCampanha = await prisma.correction.count({ where: { status: "pending", contact: { is: { ...ondeSem, ...escopoProp } } } });
    const nomes = (await prisma.contact.findMany({ where: { campanha: { not: null } }, select: { campanha: true }, distinct: ["campanha"] }))
      .map((c) => c.campanha as string)
      .filter((c) => isCampanhaAtiva(c));
    pending = nomes.length === 0 ? [] : await prisma.correction.findMany({
      where: {
        status: "pending",
        contact: { is: { campanha: { in: nomes }, ...(proprietario ? { proprietario } : {}) } },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        oldValue: true,
        reason: true,
        contact: {
          select: { id: true, cidade: true, estado: true, nomePrefeito: true, campanha: true, regiao: true, proprietario: true },
        },
      },
    });
  }

  return (
    <>
      <PageHeader title="Correção de Contatos" action={prevendedor ? undefined : <CrmSync />} />
      <div className="space-y-8 p-8">
        <section>
          {semVinculo ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-12 text-center shadow-sm">
              <p className="text-sm text-amber-700">
                Seu usuário ainda não está vinculado a um &quot;Proprietário&quot; do HubSpot.
                Peça a um administrador para fazer o vínculo em Usuários — aí a sua fila de
                correção aparece aqui.
              </p>
            </div>
          ) : pending.length === 0 && semCampanha === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <p className="text-sm text-slate-500">
                Nenhuma correção pendente. A integração com o HubSpot é sincronizada
                automaticamente — assim que aparecer um telefone incorreto no CRM, ele
                surge aqui.
              </p>
            </div>
          ) : (
            <>
              {modoSem && (
                <Link href="/correcoes" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  ← Voltar às campanhas ativas
                </Link>
              )}
              <CorrectionsList items={pending} hideProprietario={prevendedor} semCampanha={semCampanha} />
            </>
          )}
        </section>
      </div>
    </>
  );
}
