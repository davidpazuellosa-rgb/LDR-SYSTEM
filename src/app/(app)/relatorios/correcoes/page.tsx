import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { currentRole } from "@/lib/current-role";
import { isAdmin } from "@/lib/permissions";
import { getProprietarioDoUsuario } from "@/lib/user-proprietario";
import PageHeader from "@/components/PageHeader";
import RelatoriosTabs from "@/components/RelatoriosTabs";
import RelatorioOperador, { type RelatorioRow } from "@/components/RelatorioOperador";

export const dynamic = "force-dynamic";

// Correções do próprio operador (LDR / Pré-vendedor). O admin usa o Histórico de Correções.
export default async function CorrecoesRelatorioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = await currentRole(session);
  if (isAdmin(role)) redirect("/historico-correcoes");
  const meId = (session.user as { id?: string }).id || "";

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
      <PageHeader title="Relatórios" />
      <main className="mx-auto max-w-[1400px] space-y-5 p-6">
        <RelatoriosTabs ativa="correcoes" admin={false} />
        <RelatorioOperador rows={data} filaGlobal={filaGlobal} />
      </main>
    </>
  );
}
