import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import CorrectionsList from "@/components/CorrectionsList";
import CrmSyncButton from "@/components/CrmSyncButton";

export const dynamic = "force-dynamic";

export default async function CorrecoesPage() {
  const pending = await prisma.correction.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    include: {
      contact: {
        select: {
          id: true,
          cidade: true,
          estado: true,
          nomePrefeito: true,
          campanha: true,
          regiao: true,
          proprietario: true,
        },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Correção de Contatos"
        action={<CrmSyncButton />}
      />
      <div className="space-y-8 p-8">
        <section>
          {pending.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <CrmSyncButton variant="empty" />
            </div>
          ) : (
            <CorrectionsList items={pending} />
          )}
        </section>
      </div>
    </>
  );
}
