import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseToken, verifyInvite } from "@/lib/invite";
import { ROLE_LABELS } from "@/lib/permissions";
import DefinirSenhaForm from "@/components/DefinirSenhaForm";
import SasiLogo from "@/components/SasiLogo";

export const dynamic = "force-dynamic";

export default async function DefinirSenhaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = parseToken(token);

  let valid = false;
  let email = "";
  let name = "";
  let role = "";
  let reason = "Link inválido.";

  if (parsed) {
    const user = await prisma.user.findUnique({
      where: { id: parsed.userId },
      select: { email: true, name: true, role: true, passwordHash: true },
    });
    if (user) {
      const check = verifyInvite(user.passwordHash, parsed.secret);
      if (check.ok) {
        valid = true;
        email = user.email;
        name = user.name || "";
        role = ROLE_LABELS[user.role] || user.role;
      } else {
        reason = check.reason || reason;
      }
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <SasiLogo height={34} className="text-indigo-700" />
        </div>

        {valid ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-800">Crie sua senha de acesso</h1>
            <p className="mt-1 text-sm text-slate-500">
              Você foi convidado(a) para o SASI LDR Hub como <span className="font-medium text-slate-700">{role}</span>.
              Defina uma senha para concluir seu cadastro.
            </p>
            <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{email}</div>
            <div className="mt-5">
              <DefinirSenhaForm token={token} initialName={name} />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-slate-800">Convite indisponível</h1>
            <p className="mt-1 text-sm text-slate-500">{reason}</p>
            <Link href="/login" className="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Ir para o login
            </Link>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">SASI LDR Hub · acesso seguro</p>
      </div>
    </main>
  );
}
