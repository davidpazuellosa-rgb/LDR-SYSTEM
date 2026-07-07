"use client";

import { useEffect, useState } from "react";
import { apiPath } from "@/lib/path";
import { useToast } from "@/components/Toast";

type Status = { configurado: boolean; retencaoDias: number; ultimo: { file: string; sizeBytes: number; criadoEm: string } | null };
type Result = { ok: true; file: string; sizeBytes: number; tabelas: number; removidos: number } | { ok: false; error: string };

const fmtBytes = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`);
const fmtData = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function BackupPanel() {
  const toast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(apiPath("/api/backup"))
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  async function backupAgora() {
    setLoading(true);
    const loadingId = toast.loading("Fazendo backup...", "Isso pode levar alguns segundos.");
    try {
      const res = await fetch(apiPath("/api/backup"), { method: "POST" });
      const data = (await res.json()) as Result;
      toast.dismiss(loadingId);
      if (data.ok) {
        toast.success("Backup concluído.", `${data.tabelas} tabelas · ${fmtBytes(data.sizeBytes)}`);
        setStatus((s) => (s ? { ...s, ultimo: { file: data.file, sizeBytes: data.sizeBytes, criadoEm: new Date().toISOString() } } : s));
      } else {
        toast.error("Falha no backup.", data.error);
      }
    } catch (e) {
      toast.dismiss(loadingId);
      toast.error("Falha no backup.", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!status) return null;

  return (
    <div className="max-w-2xl space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-800">Backup automático do banco</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            status.configurado ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.configurado ? "bg-emerald-500" : "bg-amber-500"}`} />
          {status.configurado ? "Ativo" : "Não configurado"}
        </span>
      </div>

      {status.configurado ? (
        <>
          <p className="text-sm text-slate-500">
            Todas as tabelas são copiadas automaticamente todo dia às 05:00 (UTC) para um armazenamento externo,
            mantendo os últimos {status.retencaoDias} dias.
          </p>
          {status.ultimo ? (
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div>
                Último backup: <span className="font-medium text-slate-800">{fmtData(status.ultimo.criadoEm)}</span>
              </div>
              <div className="mt-0.5 text-xs text-slate-400">{status.ultimo.file} · {fmtBytes(status.ultimo.sizeBytes)}</div>
            </div>
          ) : (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Ainda não há nenhum backup registrado. Clique em &quot;Fazer backup agora&quot; para gerar o primeiro.
            </p>
          )}
          <button
            onClick={backupAgora}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Fazendo backup..." : "Fazer backup agora"}
          </button>
        </>
      ) : (
        <div className="space-y-2 text-sm text-slate-500">
          <p>
            Nenhum backup automático está configurado — os dados dependem só do soft-delete dentro do app
            (excluir é reversível, mas não protege contra um problema no banco em si).
          </p>
          <details className="rounded-lg bg-slate-50 px-4 py-3">
            <summary className="cursor-pointer font-medium text-slate-700">Como ativar</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>No Supabase: <strong>Storage → New bucket</strong>, nome <code>backups</code>, privado (Public OFF).</li>
              <li>Em <strong>Project Settings → API</strong>, copie a chave <code>service_role</code> (secreta).</li>
              <li>No Vercel, adicione a variável <code>SUPABASE_SERVICE_ROLE_KEY</code> (Production) com essa chave.</li>
              <li>Faça um novo deploy. O backup passa a rodar todo dia às 05:00 (UTC) automaticamente.</li>
            </ol>
          </details>
        </div>
      )}
    </div>
  );
}
