"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";

type State = "idle" | "running" | "done" | "error";

function GraduationIcon({ spin }: { spin?: boolean }) {
  return (
    <svg className={`h-4 w-4 ${spin ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {spin ? (
        <>
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M22 10 12 5 2 10l10 5 10-5Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 12v5c0 1 2.5 2.5 6 2.5s6-1.5 6-2.5v-5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

export default function AlunoSyncButton() {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [detail, setDetail] = useState<string | null>(null);

  async function run() {
    if (state === "running") return;
    setState("running");
    setDetail(null);
    try {
      const res = await fetch(apiPath("/api/aluno-a-bordo/sync"), { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        const r = data.resumo || {};
        setState("done");
        setDetail(`${r.total ?? 0} contatos · ${r.naFila ?? 0} na fila`);
        router.refresh();
      } else {
        setState("error");
        setDetail(data.detail ?? "Falha ao importar.");
      }
    } catch (e) {
      setState("error");
      setDetail((e as Error).message);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={state === "running"}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-60"
        title="Cria/atualiza a base Aluno a Bordo a partir das listas do HubSpot."
      >
        <GraduationIcon spin={state === "running"} />
        {state === "running" ? "Importando…" : "Importar Aluno a Bordo"}
      </button>
      {state === "done" && detail && <span className="text-xs text-emerald-600">✓ {detail}</span>}
      {state === "error" && <span className="text-xs text-red-500" title={detail ?? ""}>✗ {detail}</span>}
    </div>
  );
}
