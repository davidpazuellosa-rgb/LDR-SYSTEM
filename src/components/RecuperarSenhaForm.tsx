"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPath } from "@/lib/path";

export default function RecuperarSenhaForm() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await fetch(apiPath("/api/recuperar-senha"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      // Sucesso é sempre o mesmo, exista a conta ou não — é de propósito: a tela não
      // pode virar um jeito de descobrir quem tem acesso ao sistema.
      setEnviado(true);
    } catch {
      setErro("Não foi possível enviar agora. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-slate-800">Verifique seu e-mail</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha.
          Ele vale por <strong>1 hora</strong>.
        </p>
        <p className="mt-4 text-xs text-slate-400">
          Não chegou? Confira a caixa de spam ou tente de novo em 1 minuto.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <h1 className="text-xl font-semibold text-slate-800">Esqueceu sua senha?</h1>
      <p className="mt-1 text-sm text-slate-500">
        Digite seu e-mail e enviaremos um link para criar uma nova senha.
      </p>

      <label className="mb-1 mt-5 block text-xs font-medium text-slate-600">E-mail</label>
      <input
        type="email"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="voce@sasi.com.br"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
      />

      {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={!email.trim() || enviando}
        className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {enviando ? "Enviando…" : "Enviar link de recuperação"}
      </button>

      <Link
        href="/login"
        className="mt-4 block text-center text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        Voltar para o login
      </Link>
    </form>
  );
}
