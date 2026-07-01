import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { currentRole } from "@/lib/current-role";
import { getProprietarioDoUsuario } from "@/lib/user-proprietario";
import PageHeader from "@/components/PageHeader";
import CorrectionsList from "@/components/CorrectionsList";
import CrmSync from "@/components/CrmSync";

export const dynamic = "force-dynamic";

export default async function CorrecoesPage() {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  const prevendedor = (await currentRole(session)) === "prevendedor";

  // Pré-vendedor: só vê a fila do PROPRIETÁRIO vinculado a ele. Sem vínculo → nada.
  const proprietario = prevendedor ? await getProprietarioDoUsuario(u?.id || "") : null;
  const semVinculo = prevendedor && !proprietario;

  const pending = semVinculo
    ? []
    : await prisma.correction.findMany({
        where: {
          status: "pending",
          ...(proprietario ? { contact: { is: { proprietario } } } : {}),
        },
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
          ) : pending.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <p className="text-sm text-slate-500">
                Nenhuma correção pendente. A integração com o HubSpot é sincronizada
                automaticamente — assim que aparecer um telefone incorreto no CRM, ele
                surge aqui.
              </p>
            </div>
          ) : (
            <CorrectionsList items={pending} hideProprietario={prevendedor} />
          )}
        </section>
      </div>
    </>
  );
}
