import RecuperarSenhaForm from "@/components/RecuperarSenhaForm";
import SasiLogo from "@/components/SasiLogo";

export const dynamic = "force-dynamic";

// PÚBLICA (sem login) — pedir o link de recuperação de senha.
export default function RecuperarSenhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <SasiLogo height={34} className="text-indigo-700" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <RecuperarSenhaForm />
        </div>
      </div>
    </main>
  );
}
