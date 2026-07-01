import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import RelatorioOperador, { type RelatorioRow } from "@/components/RelatorioOperador";

export const dynamic = "force-dynamic";

// Relatório do próprio operador (LDR / Pré-vendedor): só os dados DELE.
export default async function RelatorioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const meId = (session.user as { id?: string }).id || "";

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
    prisma.correction.count({ where: { status: "pending" } }),
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
      <div className="p-8">
        <RelatorioOperador rows={data} filaGlobal={filaGlobal} />
      </div>
    </>
  );
}
