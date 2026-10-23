"use client";

import { useEffect, useState } from "react";
import { apiPath } from "@/lib/path";
import { VERSAO_ATUAL, precisaAtualizar } from "@/lib/versao";

const INTERVALO_MS = 60_000;

// Aviso FIXO de nova versão: confere /api/versao a cada minuto, ao voltar para a aba e ao
// reconectar. Se a publicação mudou, mostra o aviso com o botão Recarregar (não some sozinho).
export default function AtualizacaoBanner() {
  const [nova, setNova] = useState(false);

  useEffect(() => {
    if (VERSAO_ATUAL === "dev") return;
    let vivo = true;
    async function conferir() {
      try {
        const res = await fetch(apiPath("/api/versao"), { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (vivo && precisaAtualizar(VERSAO_ATUAL, data?.versao)) setNova(true);
      } catch {
        /* sem rede ou servidor reiniciando: tenta de novo no próximo ciclo */
      }
    }
    const t = setInterval(conferir, INTERVALO_MS);
    const aoVoltar = () => { if (document.visibilityState === "visible") conferir(); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("online", conferir);
    conferir();
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", conferir);
    };
  }, []);

  if (!nova) return null;
  return (
    <div role="alert" className="fixed left-1/2 top-3 z-[200] w-[min(560px,calc(100vw-24px))] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-xl bg-indigo-600 px-4 py-3 text-white shadow-2xl ring-1 ring-[rgba(255,255,255,0.15)]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[rgba(255,255,255,0.2)]">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Nova versão do sistema disponível</div>
          <div className="text-xs text-[#e0e7ff]">Recarregue a página para usar as novidades.</div>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-[#4338ca] transition hover:bg-[#eef2ff]"
        >
          Recarregar
        </button>
      </div>
    </div>
  );
}
