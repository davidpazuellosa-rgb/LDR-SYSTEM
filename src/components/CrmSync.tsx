"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";

// Ressincroniza sozinho enquanto a página está aberta.
const AUTO_INTERVAL_MS = 3 * 60_000; // a cada 3 min

type State = "idle" | "running" | "done" | "error";

function RefreshIcon({ spin }: { spin?: boolean }) {
  return (
    <svg className={`h-4 w-4 ${spin ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ago(ts: number | null): string {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "agora mesmo";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  return `há ${h} h`;
}

export default function CrmSync() {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [, setTick] = useState(0); // re-render periódico para atualizar "há X min"
  const runningRef = useRef(false);

  const sync = useCallback(
    async (manual: boolean) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setState("running");
      if (manual) setDetail(null);
      try {
        const res = await fetch(apiPath(`/api/crm/sync${manual ? "?force=1" : ""}`), { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setState("done");
          setDetail(data.detail ?? null);
          setSyncedAt(data.syncedAt ?? Date.now());
          router.refresh();
        } else {
          setState("error");
          setDetail(data.detail ?? data.error ?? "Erro desconhecido.");
        }
      } catch (e) {
        setState("error");
        setDetail((e as Error).message);
      } finally {
        runningRef.current = false;
      }
    },
    [router]
  );

  // Auto-sync ao montar + a cada AUTO_INTERVAL_MS.
  useEffect(() => {
    sync(false);
    const iv = setInterval(() => sync(false), AUTO_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [sync]);

  // Ressincroniza ao voltar para a aba.
  useEffect(() => {
    const onFocus = () => sync(false);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [sync]);

  // Atualiza o texto "há X min" sem refazer a sync.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const dotColor = state === "error" ? "bg-red-400" : "bg-emerald-400";
  const label =
    state === "running"
      ? "Sincronizando com HubSpot…"
      : state === "error"
      ? `Erro: ${detail ?? "falha na sincronização"}`
      : syncedAt
      ? `Sincronizado ${ago(syncedAt)}`
      : "Sincronização automática ativa";

  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1.5 text-xs text-slate-500" title="A integração com o HubSpot é sincronizada automaticamente.">
        <span className={`inline-block h-2 w-2 rounded-full ${dotColor} ${state === "running" ? "animate-pulse" : ""}`} />
        {label}
      </span>
      <button
        onClick={() => sync(true)}
        disabled={state === "running"}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-wait disabled:opacity-60"
      >
        <RefreshIcon spin={state === "running"} />
        {state === "running" ? "Sincronizando…" : "Sincronizar agora"}
      </button>
    </div>
  );
}
