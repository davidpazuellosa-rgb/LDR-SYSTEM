import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import HubspotTestButton from "@/components/HubspotTestButton";
import { isHubspotConfigured } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

export default async function HubspotPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdmin(role)) redirect("/dashboard"); // área sensível: só admin

  const configured = isHubspotConfigured();

  return (
    <>
      <PageHeader title="HubSpot CRM" />
      <div className="space-y-6 p-8">
        <div className={`rounded-2xl p-5 shadow-sm ${configured ? "bg-emerald-50" : "bg-amber-50"}`}>
          <div className="font-semibold">
            <span className={configured ? "text-emerald-700" : "text-amber-700"}>
              {configured ? "🔑 Token configurado" : "⚠️ Token não configurado"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {configured
              ? "Há um token salvo no servidor. Clique em “Testar conexão” para confirmar que ele é válido."
              : "Defina HUBSPOT_TOKEN no arquivo .env e reinicie o servidor para ativar a integração."}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-semibold text-slate-800">Status da conexão</h2>
          <p className="mb-4 text-sm text-slate-500">
            Esta verificação apenas confirma que o sistema consegue se autenticar no HubSpot
            (consulta os dados da conta, em modo somente leitura). Nenhum contato é criado,
            atualizado, importado ou exportado.
          </p>
          <HubspotTestButton disabled={!configured} />
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-semibold text-slate-800">Como configurar o token</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>No HubSpot: <strong>Configurações → Integrações → Aplicativos privados</strong>.</li>
            <li>Crie um <strong>Private App</strong> e habilite ao menos um escopo de leitura
              (ex.: <code>crm.objects.contacts.read</code>).</li>
            <li>Copie o <strong>Access Token</strong> (começa com <code>pat-</code>).</li>
            <li>Cole em <code>HUBSPOT_TOKEN</code> no arquivo <code>.env</code> e reinicie o servidor.</li>
          </ol>
        </div>
      </div>
    </>
  );
}
