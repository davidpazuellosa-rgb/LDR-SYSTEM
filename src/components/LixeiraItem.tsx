"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";

export default function LixeiraItem({ id, nome, contatos, quando, quem, diasRestantes }: { id: string; nome: string; contatos: number; quando: string; quem: string | null; diasRestantes: number }) {
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);

  async function restaurar() {
    setBusy(true);
    const load = toast.loading("Restaurando planilha...", nome);
    try {
      const res = await fetch(apiPath(`/api/lixeira/${id}`), { method: "POST" });
      const data = await res.json().catch(() => ({}));
      toast.dismiss(load);
      if (!res.ok) return toast.error("Não foi possível restaurar.", data.error);
      toast.success("Planilha restaurada.", `${nome} voltou com todos os dados.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  async function apagarDeVez() {
    if (!(await dialog.confirm({ title: `Apagar "${nome}" de vez?`, message: "Esta cópia some da lixeira e NÃO tem como recuperar.", confirmLabel: "Apagar de vez", danger: true }))) return;
    setBusy(true);
    await fetch(apiPath(`/api/lixeira/${id}`), { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-slate-800">{nome}</div>
        <div className="text-xs text-slate-500">
          {contatos.toLocaleString("pt-BR")} contatos · apagada em {quando}{quem ? ` por ${quem}` : ""} · some em {diasRestantes} dia(s)
        </div>
      </div>
      <button onClick={restaurar} disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Restaurar</button>
      <button onClick={apagarDeVez} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">Apagar de vez</button>
    </div>
  );
}
