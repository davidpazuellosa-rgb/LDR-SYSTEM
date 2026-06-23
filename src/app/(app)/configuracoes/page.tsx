import { auth } from "@/auth";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const session = await auth();

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
