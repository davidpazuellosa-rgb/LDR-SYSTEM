"use client";

import { useCallback, useEffect, useState } from "react";
import { apiPath } from "@/lib/path";

type Scanned = {
  nome?: string;
  cargo?: string;
  telefone?: string;
  email?: string;
  tipo?: string;
  origem?: string;
  validacao?: {
    status: "ok" | "warning";
    checks: string[];
    warnings: string[];
  };
};

type SavedScan = {
  id: string;
  contatos: Scanned[];
  error?: string | null;
  resumo?: string | null;
  createdAt?: string;
};

function formatScanDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function phoneKind(contact: Scanned) {
  const raw = `${contact.tipo || ""} ${contact.cargo || ""} ${contact.origem || ""}`.toLowerCase();
  if (raw.includes("whatsapp") || raw.includes("zap")) return "WhatsApp";
  if (raw.includes("gabinete")) return "Gabinete";
  if (raw.includes("secretaria")) return "Secretaria";
  if (raw.includes("geral") || raw.includes("recep")) return "Geral";
  return "Outro";
}

function kindStyle(kind: string) {
  switch (kind) {
    case "WhatsApp": return "bg-emerald-50 text-emerald-700";
    case "Gabinete": return "bg-indigo-50 text-indigo-700";
    case "Secretaria": return "bg-violet-50 text-violet-700";
    case "Geral": return "bg-sky-50 text-sky-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

const KIND_ORDER: Record<string, number> = { Gabinete: 0, Geral: 1, WhatsApp: 2, Secretaria: 3, Outro: 4 };

function sourceHost(origem?: string) {
  if (!origem) return "";
  try {
    return new URL(origem).hostname.replace(/^www\./, "");
  } catch {
    return origem;
  }
}

function hasUsablePhone(contact: Scanned) {
  const digits = (contact.telefone || "").replace(/\D/g, "");
  const normalized = digits.startsWith("55") ? digits.slice(2) : digits;

  return normalized.length === 10 || normalized.length === 11;
}

function whatsappUrl(contact: Scanned) {
  const digits = (contact.telefone || "").replace(/\D/g, "");
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;

  return normalized.length >= 12 && normalized.length <= 13
    ? `https://web.whatsapp.com/send?phone=${normalized}`
    : "";
}

function PhoneGlyph() {
  return (
    <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
    </svg>
  );
}

function MailGlyph() {
  return (
    <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkGlyph() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 14a4 4 0 0 0 6 .5l2.5-2.5a4 4 0 0 0-5.7-5.7L11.5 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 10a4 4 0 0 0-6-.5L5.5 12a4 4 0 0 0 5.7 5.7L12.5 16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ScanModal({
  contactId,
  titulo,
  onClose,
  onUsePhone,
}: {
  contactId: string;
  titulo: string;
  onClose: () => void;
  onUsePhone?: (phone: string, meta?: { hasWhatsapp?: boolean }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<SavedScan | null>(null);

  const loadSaved = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiPath(`/api/contacts/${contactId}/scan`), { method: "GET" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Não foi possível carregar a última varredura.");
        return;
      }
      setScan(data.scan);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  async function runScan() {
    setScanning(true);
    setError(null);

    try {
      const res = await fetch(apiPath(`/api/contacts/${contactId}/scan`), { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Não foi possível fazer a varredura.");
        if (data.scan) setScan(data.scan);
        return;
      }
      setScan(data.scan || data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    let alive = true;
    loadSaved().finally(() => {
      if (!alive) return;
    });
    return () => {
      alive = false;
    };
  }, [loadSaved]);

  const contatos = (scan?.contatos || []).filter(hasUsablePhone);
  const lastRun = formatScanDate(scan?.createdAt);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{titulo}</h2>
            {lastRun && <p className="mt-1 text-xs text-slate-400">Última busca: {lastRun}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12 text-slate-500">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
              Carregando última varredura...
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                  <div className="font-semibold">Não foi possível concluir</div>
                  <p className="mt-1">{error}</p>
                </div>
              )}

              {!scan && !error && (
                <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
                  Nenhuma varredura salva para este contato.
                </div>
              )}

              {scan && contatos.length === 0 && !error && (
                <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
                  {scan.resumo || "Nenhum telefone encontrado na última varredura."}
                </div>
              )}

              {contatos.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {contatos.length} resultado(s) encontrado(s)
                  </p>
                  {[...contatos]
                    .sort((a, b) => (KIND_ORDER[phoneKind(a)] ?? 9) - (KIND_ORDER[phoneKind(b)] ?? 9))
                    .map((contact, index) => {
                      const kind = phoneKind(contact);
                      const host = sourceHost(contact.origem);
                      const whatsappHref = whatsappUrl(contact);
                      return (
                        <div
                          key={`${contact.telefone}-${contact.email}-${index}`}
                          className="rounded-xl border border-slate-200 p-4 transition hover:border-indigo-200 hover:shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-800">{contact.nome || "(sem nome)"}</span>
                                <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${kindStyle(kind)}`}>
                                  {kind}
                                </span>
                              </div>
                              {contact.cargo && <div className="mt-0.5 text-xs text-slate-500">{contact.cargo}</div>}
                            </div>

                            <div className="flex shrink-0 flex-wrap justify-end gap-2">
                              {contact.telefone && onUsePhone && (
                                <button
                                  onClick={() => {
                                    onUsePhone(contact.telefone || "", { hasWhatsapp: phoneKind(contact) === "WhatsApp" });
                                    onClose();
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                                >
                                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                  Usar este
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 space-y-1.5">
                            {contact.telefone && (
                              <div className="flex flex-wrap items-center gap-2 text-base font-medium text-slate-800">
                                <span className="inline-flex items-center gap-2">
                                  <PhoneGlyph />
                                  {contact.telefone}
                                </span>
                                {whatsappHref && (
                                  <a
                                    href={whatsappHref}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700"
                                  >Validar WhatsApp Web</a>
                                )}
                              </div>
                            )}
                            {contact.email && (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <MailGlyph />
                                <span className="truncate">{contact.email}</span>
                              </div>
                            )}
                          {host && (
                            <div title={contact.origem} className="flex items-center gap-1.5 text-xs text-slate-400">
                              <LinkGlyph />
                              <span className="truncate">{host}</span>
                            </div>
                          )}
                          {contact.validacao && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {contact.validacao.checks.slice(0, 3).map((check) => (
                                <span
                                  key={check}
                                  title={check}
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                                >
                                  <span aria-hidden="true">✓</span>
                                  {check}
                                </span>
                              ))}
                              {contact.validacao.warnings.slice(0, 2).map((warning) => (
                                <span
                                  key={warning}
                                  title={warning}
                                  className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                                >
                                  <span aria-hidden="true">!</span>
                                  {warning}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={runScan}
            disabled={loading || scanning}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {scanning && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {scanning ? "Buscando..." : scan ? "Buscar novamente" : "Buscar agora"}
          </button>
        </div>
      </div>
    </div>
  );
}
