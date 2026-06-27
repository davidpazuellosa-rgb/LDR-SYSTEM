"use client";

import { useState } from "react";
import { apiPath } from "@/lib/path";
import { useToast } from "@/components/Toast";

type Item = {
  id: string;
  usuarioNome: string | null;
  texto: string;
  audio: string | null;
  status: string;
  criadoEm: string;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Copia texto de forma robusta: tenta a API moderna (precisa de HTTPS/contexto
// seguro) e, se falhar ou não existir, cai no fallback antigo (textarea +
// execCommand) que funciona em qualquer contexto. Retorna true se copiou.
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // segue para o fallback
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    ta.setAttribute("readonly", "");
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function CopyIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" strokeLinecap="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SuggestionsList({ initial }: { initial: Item[] }) {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copy(it: Item) {
    // Texto da sugestão; se for só áudio (sem texto), copia o link do áudio
    // para que "tudo dê pra copiar".
    const text = (it.texto && it.texto.trim()) || it.audio || "";
    if (!text) {
      toast.error("Nada para copiar nesta sugestão.", "");
      return;
    }
    if (await copyToClipboard(text)) {
      setCopiedId(it.id);
      setTimeout(() => setCopiedId((c) => (c === it.id ? null : c)), 1500);
    } else {
      toast.error("Não foi possível copiar.", "");
    }
  }

  async function toggle(it: Item) {
    const status = it.status === "resolvida" ? "nova" : "resolvida";
    setBusy(it.id);
    try {
      const res = await fetch(apiPath(`/api/sugestoes/${it.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, status } : x)));
      else toast.error("Não foi possível atualizar a sugestão.", "");
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
        Nenhuma sugestão recebida ainda.
      </div>
    );
  }

  const novas = items.filter((i) => i.status !== "resolvida").length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {items.length} {items.length === 1 ? "sugestão" : "sugestões"} · {novas} em aberto
      </p>
      {items.map((it) => {
        const resolvida = it.status === "resolvida";
        return (
          <div
            key={it.id}
            className={`rounded-2xl border bg-white p-5 shadow-sm ${resolvida ? "border-slate-200 opacity-70" : "border-l-4 border-l-indigo-500 border-slate-200"}`}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="font-semibold text-slate-800">{it.usuarioNome || "Anônimo"}</span>
                <span className="ml-2 text-xs text-slate-400">{fmt(it.criadoEm)}</span>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                  resolvida ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-indigo-50 text-indigo-700 ring-indigo-200"
                }`}
              >
                {resolvida ? "Resolvida" : "Nova"}
              </span>
            </div>

            <div className="flex items-start justify-between gap-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{it.texto}</p>
              <button
                onClick={() => copy(it)}
                title="Copiar texto"
                aria-label="Copiar texto"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                {copiedId === it.id ? <CheckIcon /> : <CopyIcon />}
              </button>
            </div>

            {it.audio && <audio src={it.audio} controls className="mt-3 h-9 w-full max-w-md" />}

            <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
              <button
                onClick={() => toggle(it)}
                disabled={busy === it.id}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === it.id ? "Salvando…" : resolvida ? "Reabrir" : "Marcar como resolvida"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
