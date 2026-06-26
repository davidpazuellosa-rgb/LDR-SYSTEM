"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";
import { useToast } from "@/components/Toast";

// Form do nível 1: cria um órgão (tipo de órgão) já com as 5 regiões do Brasil.
export default function NovoOrgaoButton() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function criar() {
    const n = nome.trim();
    if (!n) {
      toast.error("Informe o nome do órgão.");
      return;
    }

    setSaving(true);
    const loadingId = toast.loading("Criando órgão...", "Gerando as 5 regiões do Brasil.");

    try {
      const res = await fetch(apiPath("/api/orgaos"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: n, description }),
      });
      const data = await res.json().catch(() => ({}));
      toast.dismiss(loadingId);

      if (!res.ok) {
        toast.error("Não foi possível criar o órgão.", data.error || `Erro ${res.status}.`);
        return;
      }

      toast.success("Órgão criado.", `${n} · ${data.criadas ?? 0} região(ões) criada(s).`);
      setOpen(false);
      setNome("");
      setDescription("");
      router.push(`/bases?tipo=${encodeURIComponent(n)}`);
    } catch (error) {
      toast.dismiss(loadingId);
      toast.error("Não foi possível criar o órgão.", (error as Error).message);
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
        Novo órgão
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-slate-800">Novo órgão</h2>
            <p className="mb-4 text-sm text-slate-500">
              Cria um tipo de órgão já com as 5 regiões do Brasil (Norte, Nordeste, Centro-Oeste, Sudeste e Sul).
            </p>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Nome do órgão
                <input
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  autoFocus
                  placeholder="Ex.: Secretaria de Saúde"
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
                onClick={criar}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? "Criando..." : "Criar órgão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
