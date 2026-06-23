"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";
import { useToast } from "@/components/Toast";

const SOLUCOES = ["MetaGov"];

export default function NewBaseButton() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [solucao, setSolucao] = useState(SOLUCOES[0]);
  const [local, setLocal] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function createBase() {
    const name = `${solucao}${local ? ` - ${local}` : ""}`.trim();
    if (!name) {
      toast.error("Informe o nome da base.");
      return;
    }

    setSaving(true);
    const loadingId = toast.loading("Criando base...", "Aguarde enquanto salvamos a nova base.");

    try {
      const res = await fetch(apiPath("/api/bases"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.dismiss(loadingId);
        toast.error("Não foi possível criar a base.", data.error || `Erro ${res.status}.`);
        return;
      }

      toast.dismiss(loadingId);
      toast.success("Base criada.", name);
      setOpen(false);
      setLocal("");
      setDescription("");
      router.push(`/bases/${data.id}`);
    } catch (error) {
      toast.dismiss(loadingId);
      toast.error("Não foi possível criar a base.", (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Nova base
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-slate-800">Nova base de dados</h2>
            <p className="mb-4 text-sm text-slate-500">Crie uma base vazia para importar ou cadastrar contatos.</p>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Solução
                <select
                  value={solucao}
                  onChange={(event) => setSolucao(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                >
                  {SOLUCOES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Local
                <input
                  value={local}
                  onChange={(event) => setLocal(event.target.value)}
                  placeholder="Ex.: Nordeste"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Descrição
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Observações internas"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={createBase}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? "Criando..." : "Criar base"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
