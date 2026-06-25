"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";

export default function DefinirSenhaForm({ token, initialName }: { token: string; initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= 8 && confirm === password && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiPath("/api/convite"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, name: name.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setDone(true);
        setTimeout(() => router.push(apiPath("/login")), 1800);
      } else {
        setError(data.error || "Não foi possível definir a senha.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        Senha criada com sucesso! Redirecionando para o login…
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-3"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Seu nome</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome completo"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Senha (mín. 8 caracteres)</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 ${tooShort ? "border-red-300" : "border-slate-300"}`}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Confirme a senha</label>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 ${mismatch ? "border-red-300" : "border-slate-300"}`}
        />
        {mismatch && <p className="mt-1 text-xs text-red-500">As senhas não coincidem.</p>}
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-500">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="rounded" />
        Mostrar senha
      </label>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Salvando…" : "Criar senha e entrar"}
      </button>
    </form>
  );
}
