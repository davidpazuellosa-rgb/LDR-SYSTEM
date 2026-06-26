import { auth } from "@/auth";
import { isAdmin } from "@/lib/permissions";
import { isHubspotConfigured } from "@/lib/hubspot";
import PageHeader from "@/components/PageHeader";
import HubspotTestButton from "@/components/HubspotTestButton";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const session = await auth();
  const admin = isAdmin((session?.user as { role?: string } | undefined)?.role);
  const hubspotConfigured = isHubspotConfigured();

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="space-y-6 p-8">
        <div className="max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-800">Sua conta</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-slate-400">Nome</dt>
              <dd className="text-slate-700">{session?.user?.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">E-mail</dt>
              <dd className="text-slate-700">{session?.user?.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Perfil</dt>
              <dd className="text-slate-700">
                {/* @ts-expect-error campo custom */}
                {session?.user?.role || "user"}
              </dd>
            </div>
          </dl>
          <p className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Para trocar a senha ou criar novos usuários da equipe, fale com o
            administrador do sistema.
          </p>
        </div>

        {/* Integração HubSpot — área sensível, só admin (antes era uma página própria) */}
        {admin && (
          <div className="max-w-2xl space-y-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-800">Integração HubSpot CRM</h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  hubspotConfigured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${hubspotConfigured ? "bg-emerald-500" : "bg-amber-500"}`} />
                {hubspotConfigured ? "Token configurado" : "Token não configurado"}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Verifica, em modo somente leitura, se o sistema consegue se autenticar no HubSpot.
              Nenhum contato é criado, atualizado, importado ou exportado.
            </p>
            <HubspotTestButton disabled={!hubspotConfigured} />
            <details className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <summary className="cursor-pointer font-medium text-slate-700">Como configurar o token</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>No HubSpot: <strong>Configurações → Integrações → Aplicativos privados</strong>.</li>
                <li>Crie um <strong>Private App</strong> com ao menos um escopo de leitura (<code>crm.objects.contacts.read</code>).</li>
                <li>Copie o <strong>Access Token</strong> (começa com <code>pat-</code>).</li>
                <li>Defina <code>HUBSPOT_TOKEN</code> nas variáveis de ambiente e refaça o deploy.</li>
              </ol>
            </details>
          </div>
        )}

        <div className="max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-semibold text-slate-800">Sobre</h2>
          <p className="text-sm text-slate-500">
            SASI LDR Hub · v1.0.0 — central de saneamento das bases comerciais da SASI.
          </p>
        </div>
      </div>
    </>
  );
}
