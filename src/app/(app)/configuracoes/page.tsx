import { auth } from "@/auth";
import { isAdmin } from "@/lib/permissions";
import { isHubspotConfigured } from "@/lib/hubspot";
import PageHeader from "@/components/PageHeader";
import HubspotTestButton from "@/components/HubspotTestButton";
import BackupPanel from "@/components/BackupPanel";
import PrdView from "@/components/PrdView";
import { secoesPrd } from "@/lib/prd";
import UsersManager from "@/components/UsersManager";
import { prisma } from "@/lib/prisma";
import { isInvitePending } from "@/lib/invite";
import { getMapaProprietarios, listarProprietarios } from "@/lib/user-proprietario";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  const admin = isAdmin((session?.user as { role?: string } | undefined)?.role);
  // "Usuários" é área sensível: só administrador (quem não é admin cai em "Geral").
  const aba = sp.aba === "ldr-hub" ? "ldr-hub" : sp.aba === "usuarios" && admin ? "usuarios" : "geral";
  const hubspotConfigured = isHubspotConfigured();

  // Aba "LDR Hub": a documentação do sistema. As partes internas (arquitetura, riscos, roadmap…)
  // só são geradas no servidor para administradores.
  const doc = aba === "ldr-hub" ? secoesPrd(admin) : null;
  const usuarios =
    aba === "usuarios"
      ? await Promise.all([
          prisma.user.findMany({
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, email: true, role: true, createdAt: true, passwordHash: true },
          }),
          getMapaProprietarios(),
          listarProprietarios(),
        ])
      : null;
  const selfId = (session?.user as { id?: string } | undefined)?.id;
  const tab = (on: boolean) =>
    `-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${on ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`;

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="space-y-6 p-8">
        <div className="flex gap-1 border-b border-slate-200">
          <Link href="/configuracoes" className={tab(aba === "geral")}>Geral</Link>
          {admin && <Link href="/configuracoes?aba=usuarios" className={tab(aba === "usuarios")}>Usuários</Link>}
          <Link href="/configuracoes?aba=ldr-hub" className={tab(aba === "ldr-hub")}>LDR Hub</Link>
        </div>

        {usuarios ? (
          <UsersManager
            initialUsers={usuarios[0].map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              createdAt: u.createdAt.toISOString(),
              pending: isInvitePending(u.passwordHash),
            }))}
            selfId={selfId || ""}
            proprietarios={usuarios[2]}
            proprietarioByUser={usuarios[1]}
          />
        ) : doc ? (
          <PrdView titulo={doc.titulo} intro={doc.intro} secoes={doc.secoes} />
        ) : (
        <>
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
            Para trocar a senha, use <strong>“Esqueci minha senha”</strong> na tela de login. Para criar
            novos usuários da equipe, fale com o administrador do sistema.
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

        {/* Backup automático do banco — só admin */}
        {admin && <BackupPanel />}

        <div className="max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-semibold text-slate-800">Sobre</h2>
          <p className="text-sm text-slate-500">
            SASI LDR Hub · v1.0.0 — central de saneamento das bases comerciais da SASI.
          </p>
        </div>
        </>
        )}
      </div>
    </>
  );
}
