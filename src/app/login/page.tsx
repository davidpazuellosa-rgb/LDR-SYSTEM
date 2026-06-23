"use client";

import { useActionState, useState } from "react";
import { login } from "./actions";
import SasiLogo from "@/components/SasiLogo";

function FeatureItem({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-indigo-200 ring-1 ring-white/10">
        {icon}
      </span>
      <span className="text-sm text-slate-300">{children}</span>
    </li>
  );
}

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, undefined);
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* ===== Coluna esquerda (navy / marca) ===== */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#191d45] px-14 py-12 lg:flex">
        {/* círculos decorativos */}
        <svg
          className="pointer-events-none absolute -bottom-40 -left-40 h-[520px] w-[520px] text-white/[0.04]"
          viewBox="0 0 200 200"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="100" cy="100" r="40" strokeWidth="1" />
          <circle cx="100" cy="100" r="65" strokeWidth="1" />
          <circle cx="100" cy="100" r="90" strokeWidth="1" />
        </svg>

        <div className="relative text-white">
          <SasiLogo height={38} />
        </div>

        <div className="relative max-w-md">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-300">
            Central de Bases Comerciais
          </p>
          <h1 className="text-5xl font-bold leading-[1.1] text-white">
            Bases comerciais limpas e confiáveis.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-slate-300">
            Importe planilhas, corrija contatos com telefone errado e envie dados
            saneados direto para o HubSpot — com histórico de tudo.
          </p>

          <ul className="mt-10 space-y-5">
            <FeatureItem
              icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            >
              Importação de planilhas CSV e Excel
            </FeatureItem>
            <FeatureItem
              icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M15.5 14.5 20 19m-2-9a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            >
              Fila de correção de telefones com histórico
            </FeatureItem>
            <FeatureItem
              icon={
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 12h4l2 6 4-12 2 6h6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            >
              Integração e envio automático ao HubSpot CRM
            </FeatureItem>
          </ul>
        </div>

        <div className="relative text-xs text-slate-400">
          SASI LDR Hub · © 2026 SASI LTDA
        </div>
      </div>

      {/* ===== Coluna direita (formulário) ===== */}
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          {/* logo no topo só no mobile */}
          <div className="mb-10 text-[#191d45] lg:hidden">
            <SasiLogo height={34} />
          </div>

          <h2 className="text-3xl font-bold text-slate-900">Entrar na plataforma</h2>
          <p className="mt-2 text-sm text-slate-500">
            Acesse o painel para sanear e organizar as bases comerciais da SASI.
          </p>

          <form action={formAction} className="mt-8 space-y-5">
            {/* E-mail */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                E-mail institucional
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="voce@sasi.com"
                  className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-3 text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">Senha</label>
                <a href="mailto:suporte@sasi.com?subject=Esqueci%20a%20senha%20-%20LDR%20Hub" className="text-sm font-medium text-indigo-600 hover:underline">
                  Esqueci a senha
                </a>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="4" y="11" width="16" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  name="password"
                  type={showPass ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-11 text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4 9 7a11 11 0 0 1-2.4 3.3M6.1 6.1A11 11 0 0 0 3 12c0 3 4 7 9 7a9.6 9.6 0 0 0 3.1-.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Manter sessão */}
            <label className="flex items-center gap-2.5 text-sm text-slate-600">
              <input
                name="remember"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Manter sessão neste dispositivo
            </label>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {pending ? "Entrando..." : "Entrar"}
              {!pending && (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Não tem acesso?{" "}
            <a href="mailto:suporte@sasi.com?subject=Acesso%20ao%20LDR%20Hub" className="font-semibold text-indigo-600 hover:underline">
              Falar com o suporte SASI
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
