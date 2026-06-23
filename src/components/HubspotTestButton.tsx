"use client";

import { useState } from "react";
import { apiPath } from "@/lib/path";
import { useToast } from "@/components/Toast";

type Result =
  | { ok: true; portalId?: number; accountType?: string; timeZone?: string; uiDomain?: string }
  | { ok: false; error: string };

export default function HubspotTestButton({ disabled }: { disabled?: boolean }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function testConnection() {
    setLoading(true);
    setResult(null);
    const loadingId = toast.loading("Testando HubSpot...", "Validando token e acesso ao portal.");

    try {
      const res = await fetch(apiPath("/api/hubspot/test"));
      const data = (await res.json()) as Result;
      setResult(data);
      toast.dismiss(loadingId);

      if (data.ok) {
        toast.success("HubSpot conectado.", data.portalId ? `Portal ${data.portalId}` : undefined);
      } else {
        toast.error("Falha na conexão HubSpot.", data.error);
      }
    } catch (error) {
      const message = (error as Error).message;
      setResult({ ok: false, error: message });
      toast.dismiss(loadingId);
      toast.error("Falha na conexão HubSpot.", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={testConnection}
        disabled={disabled || loading}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "Testando..." : "Testar conexão"}
      </button>

      {result?.ok && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="font-semibold">Conexão validada</div>
          <ul className="mt-2 space-y-0.5 text-emerald-700">
            {result.accountType && <li>Conta: {result.accountType}</li>}
            {result.timeZone && <li>Fuso horário: {result.timeZone}</li>}
            {result.uiDomain && <li>Domínio: {result.uiDomain}</li>}
          </ul>
        </div>
      )}

      {result && !result.ok && (
        <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <div className="font-semibold">Não foi possível conectar</div>
          <p className="mt-1">{result.error}</p>
        </div>
      )}
    </div>
  );
}
