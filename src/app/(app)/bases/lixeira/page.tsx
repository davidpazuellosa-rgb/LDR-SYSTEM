import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { currentRole } from "@/lib/current-role";
import { can } from "@/lib/permissions";
import { listarLixeira, DIAS_NA_LIXEIRA } from "@/lib/lixeira";
import PageHeader from "@/components/PageHeader";
import LixeiraItem from "@/components/LixeiraItem";

export const dynamic = "force-dynamic";

// Lixeira de planilhas apagadas (só quem pode apagar vê e restaura).
export default async function LixeiraPage() {
  const session = await auth();
  const role = await currentRole(session);
  if (!can(role, "contacts.delete")) redirect("/bases");
  const itens = await listarLixeira();
  const fmt = (d: Date) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <PageHeader title="Lixeira de planilhas" />
      <div className="space-y-4 p-8">
        <Link href="/bases" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700">← Voltar às Bases de Dados</Link>
        <p className="text-sm text-slate-500">
          Planilhas e órgãos apagados ficam aqui por {DIAS_NA_LIXEIRA} dias, com todos os dados, e podem ser restaurados.
        </p>
        {itens.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400 shadow-sm">A lixeira está vazia.</div>
        ) : (
          <div className="space-y-3">
            {itens.map((i) => {
              const restantes = Math.max(0, DIAS_NA_LIXEIRA - Math.floor((Date.now() - new Date(i.apagadoEm).getTime()) / 86400000));
              return <LixeiraItem key={i.id} id={i.id} nome={i.nome} contatos={i.contatos} quando={fmt(i.apagadoEm)} quem={i.apagadoPorNome} diasRestantes={restantes} />;
            })}
          </div>
        )}
      </div>
    </>
  );
}
