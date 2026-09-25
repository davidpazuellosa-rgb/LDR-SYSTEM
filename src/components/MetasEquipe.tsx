"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MetaModal from "@/components/MetaModal";

type MetaItem = { id: string; rotulo: string; tipo: string; feito: number; alvo: number; p: number; status: "ok" | "risco" | "atrasado" };
type Ldr = { id: string; nome: string; metas: MetaItem[] };

const STATUS = {
  ok: { label: "No ritmo", chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" },
  risco: { label: "Em risco", chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500" },
  atrasado: { label: "Atrasado", chip: "bg-rose-50 text-rose-600", bar: "bg-rose-500" },
} as const;

const CARD = "rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm";

export default function MetasEquipe({ ldrs }: { ldrs: Ldr[] }) {
  const router = useRouter();
  const [metaUser, setMetaUser] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-slate-500">
        Acompanhe as metas de cada LDR e crie/edite direto por aqui (ou em Usuários → Meta).
      </p>

      {ldrs.length === 0 ? (
        <div className={`${CARD} py-10 text-center text-sm text-slate-400`}>Nenhum LDR cadastrado ainda.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {ldrs.map((u) => (
            <div key={u.id} className={CARD}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-800">{u.nome}</h3>
                  <p className="text-[11px] text-slate-400">{u.metas.length} meta(s)</p>
                </div>
                <button
                  onClick={() => setMetaUser({ id: u.id, name: u.nome })}
                  className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-50"
                >
                  {u.metas.length ? "Editar metas" : "Definir metas"}
                </button>
              </div>

              {u.metas.length === 0 ? (
                <p className="py-3 text-center text-xs text-slate-400">Sem metas definidas.</p>
              ) : (
                <div className="space-y-3">
                  {u.metas.map((m) => {
                    const s = STATUS[m.status];
                    return (
                      <div key={m.id}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                          <span className="min-w-0 truncate text-slate-600">{m.rotulo}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="tabular-nums text-slate-400">{m.feito}/{m.alvo} · {m.p}%</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${s.chip}`}>{s.label}</span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.max(2, m.p)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {metaUser && (
        <MetaModal
          userId={metaUser.id}
          userName={metaUser.name}
          onClose={() => {
            setMetaUser(null);
            router.refresh(); // recarrega o progresso após salvar
          }}
        />
      )}
    </div>
  );
}
