"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";

type SyncState = "idle" | "running" | "done" | "error";

function RefreshIcon({ spin }: { spin?: boolean }) {
  return (
    <svg
      className={`h-4 w-4 ${spin ? "animate-spin" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Props = { variant?: "default" | "empty" };

export default function CrmSyncButton({ variant = "default" }: Props) {
  const router = useRouter();
  const [state, setState] = useState<SyncState>("idle");
  const [detail, setDetail] = useState<string | null>(null);

  async function handleSync() {
    if (state === "running") return;
    setState("running");
    setDetail(null);
    try {
      const res = await fetch(apiPath("/api/crm/sync"), { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setState("done");
        setDetail(data.detail ?? null);
        router.refresh();
      } else {
        setState("error");
        setDetail(data.detail ?? data.error ?? "Erro desconhecido.");
      }
    } catch (e) {
      setState("error");
      setDetail((e as Error).message);
    }
  }

  if (variant === "empty") {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-slate-500">
          {state === "done"
            ? "Sincronização concluída. Atualizando lista…"
            : state === "error"
            ? `Erro: ${detail}`
            : "Nenhuma correção pendente. Sincronize com o HubSpot para buscar os telefones incorretos."}
        </p>
        <button
          onClick={handleSync}
          disabled={state === "running"}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshIcon spin={state === "running"} />
          {state === "running" ? "Sincronizando com HubSpot…" : "Sincronizar com HubSpot CRM"}
        </button>
        {state === "done" && detail && (
          <p className="text-xs text-slate-400">{detail}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={state === "running"}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-wait disabled:opacity-60"
      >
        <RefreshIcon spin={state === "running"} />
        {state === "running" ? "Sincronizando…" : "Sincronizar HubSpot"}
      </button>
      {state === "done" && (
        <span className="text-xs text-emerald-600">✓ Sincronizado</span>
      )}
      {state === "error" && (
        <span className="text-xs text-red-500" title={detail ?? ""}>✗ Erro na sync</span>
      )}
    </div>
  );
}
