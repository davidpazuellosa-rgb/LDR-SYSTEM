"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";

// Menu "⋯" dos cards de Bases: renomear e apagar.
//  - kind "orgao": card do tipo de órgão (renomeia/apaga TODAS as planilhas dele)
//  - kind "base":  card de uma região (renomeia só o título / apaga a planilha)
export default function CardMenu({
  kind,
  nome,
  baseId,
  titulo,
  contatos,
}: {
  kind: "orgao" | "base";
  nome: string; // órgão (kind orgao) ou região (kind base)
  baseId?: string | null;
  titulo?: string;
  contatos: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fecha = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fecha);
    return () => document.removeEventListener("mousedown", fecha);
  }, [open]);

  async function chama(url: string, method: string, body: unknown, ok: string) {
    const res = await fetch(apiPath(url), { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error("Não foi possível concluir.", data.error || `Erro ${res.status}.`);
      return;
    }
    toast.success(ok);
    router.refresh();
  }

  async function renomear() {
    setOpen(false);
    const atual = kind === "orgao" ? nome : titulo || nome;
    const novo = await dialog.prompt({ title: "Editar nome", label: kind === "orgao" ? "Novo nome do órgão" : "Novo nome da planilha", defaultValue: atual });
    if (novo === null || novo.trim() === atual) return;
    if (kind === "orgao") {
      if (!novo.trim()) return;
      await chama("/api/orgaos", "PATCH", { nome, novo }, "Órgão renomeado.");
    } else if (baseId) {
      await chama(`/api/bases/${baseId}`, "PATCH", { titulo: novo }, "Planilha renomeada.");
    }
  }

  async function apagar() {
    setOpen(false);
    const qtd = contatos.toLocaleString("pt-BR");
    if (kind === "orgao") {
      const dig = await dialog.prompt({
        title: `Apagar o órgão "${nome}"?`,
        message: `Apaga TODAS as planilhas dele e os ${qtd} contatos. Não tem volta.`,
        label: "Para confirmar, digite o nome do órgão",
        confirmLabel: "Apagar",
        danger: true,
      });
      if (dig === null) return;
      if (dig.trim() !== nome) {
        toast.error("Nome não confere.", "Nada foi apagado.");
        return;
      }
      await chama("/api/orgaos", "DELETE", { nome }, "Órgão apagado.");
    } else if (baseId) {
      if (!(await dialog.confirm({ title: `Apagar a planilha "${titulo || nome}"?`, message: `Os ${qtd} contatos dela também serão apagados. Não tem volta.`, confirmLabel: "Apagar", danger: true }))) return;
      await chama(`/api/bases/${baseId}`, "DELETE", {}, "Planilha apagada.");
    }
  }

  return (
    <div ref={ref} className="absolute right-3 top-3 z-10">
      <button
        type="button"
        aria-label="Mais opções"
        title="Mais opções"
        onClick={() => setOpen((v) => !v)}
        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl">
          <button type="button" onClick={renomear} className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50">
            Editar nome
          </button>
          <button type="button" onClick={apagar} className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50">
            Apagar
          </button>
        </div>
      )}
    </div>
  );
}
