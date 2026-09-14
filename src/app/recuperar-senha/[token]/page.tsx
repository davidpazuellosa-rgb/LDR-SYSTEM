import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verificarTokenDeRecuperacao } from "@/lib/password-reset";
import DefinirSenhaForm from "@/components/DefinirSenhaForm";
import SasiLogo from "@/components/SasiLogo";

export const dynamic = "force-dynamic";

// PÚBLICA (sem login) — a pessoa cria a senha nova usando o token do e-mail.
export default async function NovaSenhaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const check = await verificarTokenDeRecuperacao(token);
  let email = "";
  if (check.ok) {
    const user = await prisma.user.findUnique({ where: { id: check.userId }, select: { email: true } });
    email = user?.email || "";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <SasiLogo height={34} className="text-indigo-700" />
        </div>

        {check.ok ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-800">Crie sua nova senha</h1>
            <p className="mt-1 text-sm text-slate-500">
              Escolha uma senha nova para acessar o SASI LDR Hub.
            </p>
            {email && <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{email}</div>}
            <div className="mt-5">
              <DefinirSenhaForm
                token={token}
                initialName=""
                endpoint="/api/recuperar-senha"
                method="PUT"
                pedirNome={false}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v5M12 16.5v.5" strokeLinecap="round" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-slate-800">Link não utilizável</h1>
            <p className="mt-2 text-sm text-slate-500">{check.reason}</p>
            <Link
              href="/recuperar-senha"
              className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Pedir um novo link
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
