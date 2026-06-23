import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import CorrectionsList from "@/components/CorrectionsList";

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
      <PageHeader title="Correção de Contatos" />
      <div className="space-y-8 p-8">
        <section>
          <CorrectionsList items={pending} />
        </section>
      </div>
    </>
  );
}
