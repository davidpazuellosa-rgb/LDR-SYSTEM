"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";
import ScanModal from "@/components/ScanModal";
import { useToast } from "@/components/Toast";
import { STATUS_META, STATUS_INCORRETO } from "@/lib/status";

type CorrectionItem = {
  id: string;
  oldValue: string | null;
  reason: string | null;
  contact: {
    id: string;
    cidade: string | null;
    estado: string | null;
    nomePrefeito: string | null;
    campanha: string | null;
    regiao: string | null;
    proprietario: string | null;
  };
};

type ScanTarget = { correctionId: string; contactId: string; titulo: string };
type ScanJobStatus = "running" | "done" | "error";
type ScanJob = { status: ScanJobStatus; message?: string };

const PHONE_PREFIX = "+55 ";

function uniq(values: (string | null | undefined)[]) {
  return Array.from(new Set(values.map((value) => (value || "").trim()).filter(Boolean))).sort();
}

function localDigits(value: string | undefined) {
  const digits = (value || "").replace(/\D/g, "");
  return digits.startsWith("55") ? digits.slice(2) : digits;
}

function formatPhone(raw: string) {
  const digits = localDigits(raw).slice(0, 11);
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (!digits) return PHONE_PREFIX;
  if (digits.length <= 2) return `${PHONE_PREFIX}(${ddd}`;
  if (rest.length <= 4) return `${PHONE_PREFIX}(${ddd}) ${rest}`;
  if (rest.length <= 8) return `${PHONE_PREFIX}(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `${PHONE_PREFIX}(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

function scanErrorMessage(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("rate limit") || lower.includes("tokens per minute") || lower.includes("429")) {
    return "Limite de varreduras atingido no momento. Aguarde alguns instantes e tente novamente.";
  }

  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "Não foi possível conectar ao servidor da varredura. Atualize a página e tente novamente.";
  }

  return message || "Não foi possível concluir a varredura agora. Tente novamente.";
}

async function fetchWithRetry(input: string, init: RequestInit, attempts = 2) {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
  }

  throw lastError;
}

function initials(city: string | null, state: string | null) {
  const first = (city || "?").trim().charAt(0).toUpperCase();
  return state ? `${first}${state}` : first;
}

function ScopeCard({
  title,
  count,
  onClick,
}: {
  title: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex min-h-24 items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md"
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-indigo-50 text-sm font-semibold text-indigo-700">
        {count}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-slate-800">{title}</div>
      </div>
      <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500">→</span>
    </button>
  );
}

function StatusPill({ reason }: { reason: string | null }) {
  const meta = STATUS_META[STATUS_INCORRETO];
  return (
    <span
      title={reason || meta.label}
      className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${meta.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M8 8H6.5A2.5 2.5 0 0 0 4 10.5v7A2.5 2.5 0 0 0 6.5 20h7A2.5 2.5 0 0 0 16 17.5V16" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 4h7v7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m11 13 8.5-8.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CorrectionsList({ items }: { items: CorrectionItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [whatsappValues, setWhatsappValues] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanTarget | null>(null);
  const [scanJobs, setScanJobs] = useState<Record<string, ScanJob>>({});
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const activeScanRef = useRef<string | null>(null);
  const [campanha, setCampanha] = useState<string | null>(null);
  const [regiao, setRegiao] = useState<string | null>(null);
  const [owner, setOwner] = useState("all");

  const campanhas = useMemo(() => uniq(items.map((item) => item.contact.campanha)), [items]);

  const regioes = useMemo(
    () => uniq(items.filter((item) => (item.contact.campanha || "") === campanha).map((item) => item.contact.regiao)),
    [items, campanha],
  );

  const filtered = useMemo(
    () =>
      items.filter(
        (item) => (item.contact.campanha || "") === campanha && (item.contact.regiao || "") === regiao,
      ),
    [items, campanha, regiao],
  );

  const ownersInScope = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of filtered) {
      const name = (item.contact.proprietario || "").trim() || "(sem proprietário)";
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const shown = useMemo(
    () =>
      owner === "all"
        ? filtered
        : filtered.filter((item) => ((item.contact.proprietario || "").trim() || "(sem proprietário)") === owner),
    [filtered, owner],
  );

  const countByCampanha = (name: string) => items.filter((item) => (item.contact.campanha || "") === name).length;
  const countByRegiao = (name: string) =>
    items.filter((item) => (item.contact.campanha || "") === campanha && (item.contact.regiao || "") === name).length;

  async function resolve(id: string) {
    const newValue = values[id];
    if (localDigits(newValue).length < 10) {
      toast.error("Digite um telefone válido com DDD.");
      return;
    }

    setSaving(id);
    const loadingId = toast.loading("Salvando correção...");

    try {
      const res = await fetch(apiPath(`/api/corrections/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newValue, hasWhatsapp: whatsappValues[id] === true }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        toast.dismiss(loadingId);
        toast.success(
          "Telefone corrigido!",
          data.hubspot?.ok
            ? "Atualizado na base local e no HubSpot."
            : "Atualizado na base local."
        );
        router.refresh();
      } else {
        toast.dismiss(loadingId);
        toast.error("Não foi possível salvar.", data.hubspot?.error || data.error || `HTTP ${res.status}.`);
      }
    } catch (error) {
      toast.dismiss(loadingId);
      toast.error("Não foi possível salvar.", (error as Error).message);
    } finally {
      setSaving(null);
    }
  }

  async function handleScan(target: ScanTarget) {
    const currentJob = scanJobs[target.contactId];
    if (currentJob?.status === "done") {
      setScan(target);
      return;
    }
    if (currentJob?.status === "running") return;
    if (activeScanRef.current && activeScanRef.current !== target.contactId) {
      toast.error("Aguarde a varredura atual.", "Só uma varredura pode rodar por vez para evitar limite da IA.");
      return;
    }

    activeScanRef.current = target.contactId;
    setActiveScanId(target.contactId);
    setScanJobs((prev) => ({ ...prev, [target.contactId]: { status: "running" } }));
    const loadingId = toast.loading("Varredura em andamento...", `Buscando contatos de ${target.titulo}.`);

    try {
      const res = await fetchWithRetry(apiPath(`/api/contacts/${target.contactId}/scan`), { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        const message = scanErrorMessage(data.error || `HTTP ${res.status}.`);
        setScanJobs((prev) => ({ ...prev, [target.contactId]: { status: "error", message } }));
        toast.update(loadingId, {
          type: "error",
          title: "Varredura não concluída.",
          description: message,
        });
        return;
      }

      setScanJobs((prev) => ({ ...prev, [target.contactId]: { status: "done" } }));
      toast.update(loadingId, {
        type: "success",
        title: "Varredura concluída!",
        description: "Use o botão Abrir para ver os contatos encontrados.",
      });
    } catch (error) {
      const message = scanErrorMessage((error as Error).message);
      setScanJobs((prev) => ({ ...prev, [target.contactId]: { status: "error", message } }));
      toast.update(loadingId, {
        type: "error",
        title: "Varredura não concluída.",
        description: message,
      });
    } finally {
      if (activeScanRef.current === target.contactId) {
        activeScanRef.current = null;
      }
      setActiveScanId((current) => (current === target.contactId ? null : current));
    }
  }

  if (items.length === 0) {
    return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Nenhuma correção pendente.</div>;
  }

  if (!campanha) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Escolha a campanha</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campanhas.map((name) => (
            <ScopeCard
              key={name}
              title={name}
              count={countByCampanha(name)}
              onClick={() => {
                setCampanha(name);
                setRegiao(null);
                setOwner("all");
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!regiao) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <button
            onClick={() => setCampanha(null)}
            className="font-medium text-indigo-600 hover:text-indigo-700"
          >
            Campanhas
          </button>
          <span className="text-slate-300">›</span>
          <span className="text-slate-500">{campanha}</span>
        </div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Escolha a região</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {regioes.map((name) => (
            <ScopeCard
              key={name}
              title={name}
              count={countByRegiao(name)}
              onClick={() => {
                setRegiao(name);
                setOwner("all");
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <button
            onClick={() => {
              setCampanha(null);
              setRegiao(null);
              setOwner("all");
            }}
            className="font-medium text-indigo-600 hover:text-indigo-700"
          >
            Campanhas
          </button>
          <span className="text-slate-300">›</span>
          <button
            onClick={() => {
              setRegiao(null);
              setOwner("all");
            }}
            className="font-medium text-indigo-600 hover:text-indigo-700"
          >
            {campanha}
          </button>
          <span className="text-slate-300">›</span>
          <span className="text-slate-500">{regiao}</span>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
          {shown.length} a corrigir
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium text-slate-500">Proprietário:</span>
        <button
          onClick={() => setOwner("all")}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
            owner === "all"
              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Todos <span className="text-xs text-slate-400">({filtered.length})</span>
        </button>
        {ownersInScope.map(([name, count]) => (
          <button
            key={name}
            onClick={() => setOwner(name)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              owner === name
                ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {name} <span className="text-xs text-slate-400">({count})</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          Nenhum contato para este filtro.
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <div className="min-w-[1180px]">
                <div className="grid grid-cols-[minmax(280px,1.25fr)_minmax(170px,.75fr)_150px_180px_220px_250px] border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <div className="px-5 py-3">Prefeitura</div>
                  <div className="px-4 py-3">Proprietário</div>
                  <div className="px-4 py-3">Status</div>
                  <div className="px-4 py-3">Telefone atual</div>
                  <div className="px-4 py-3">Novo número</div>
                  <div className="px-4 py-3 text-right">Ações</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {shown.map((item) => {
                  const cityTitle = [item.contact.cidade, item.contact.estado].filter(Boolean).join(" / ");
                  const value = values[item.id] ?? PHONE_PREFIX;
                  const valid = localDigits(value).length >= 10;
                  const scanTarget = {
                    correctionId: item.id,
                    contactId: item.contact.id,
                    titulo: cityTitle || item.contact.cidade || "Contato",
                  };
                  const scanJob = scanJobs[item.contact.id];
                  const scanRunning = scanJob?.status === "running";
                  const scanDone = scanJob?.status === "done";
                  const scanBusy = Boolean(activeScanId && activeScanId !== item.contact.id);

                  return (
                      <div
                        key={item.id}
                        className="grid grid-cols-[minmax(280px,1.25fr)_minmax(170px,.75fr)_150px_180px_220px_250px] items-center bg-white transition hover:bg-slate-50/80"
                      >
                        <div className="flex min-w-0 items-center gap-3 px-5 py-4">
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-700">
                            {initials(item.contact.cidade, item.contact.estado)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-slate-800">{item.contact.cidade || "Sem cidade"}</div>
                            <div className="truncate text-sm text-slate-500">{item.contact.nomePrefeito || "Prefeito não informado"}</div>
                          </div>
                        </div>

                        <div className="min-w-0 px-4 py-4 text-sm text-slate-600">
                          <div className="truncate">{item.contact.proprietario || "(sem proprietário)"}</div>
                        </div>

                        <div className="px-4 py-4">
                          <StatusPill reason={item.reason} />
                        </div>

                        <div className="px-4 py-4 text-sm text-slate-400 line-through decoration-slate-300">
                          {item.oldValue || "Sem telefone"}
                        </div>

                        <div className="px-4 py-4">
                          <input
                            value={value}
                            onChange={(event) => {
                              setValues((prev) => ({ ...prev, [item.id]: formatPhone(event.target.value) }));
                              setWhatsappValues((prev) => ({ ...prev, [item.id]: false }));
                            }}
                            onFocus={(event) => {
                              if (!values[item.id]) {
                                setValues((prev) => ({ ...prev, [item.id]: PHONE_PREFIX }));
                                requestAnimationFrame(() => event.currentTarget.setSelectionRange(PHONE_PREFIX.length, PHONE_PREFIX.length));
                              }
                            }}
                            placeholder="+55 (DD) 00000-0000"
                            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 px-4 py-4">
                          <button
                            onClick={() => resolve(item.id)}
                            disabled={!valid || saving === item.id}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <CheckIcon />
                            {saving === item.id ? "Salvando" : "Corrigir"}
                          </button>
                              <button
                                onClick={() => handleScan(scanTarget)}
                                disabled={scanRunning || scanBusy}
                                className={`inline-flex h-8 min-w-[76px] items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-medium transition disabled:cursor-wait disabled:opacity-70 ${
                                  scanDone
                                    ? "border-indigo-200 bg-indigo-600 text-white shadow-sm shadow-indigo-900/10 hover:bg-indigo-700"
                                    : "border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                                }`}
                              >
                                {scanDone ? <OpenIcon /> : <SearchIcon />}
                                {scanRunning ? "Buscando" : scanBusy ? "Aguarde" : scanDone ? "Abrir" : "Varredura"}
                              </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 lg:hidden">
            {shown.map((item) => {
                  const cityTitle = [item.contact.cidade, item.contact.estado].filter(Boolean).join(" / ");
                  const value = values[item.id] ?? PHONE_PREFIX;
                  const valid = localDigits(value).length >= 10;
                  const scanTarget = {
                    correctionId: item.id,
                    contactId: item.contact.id,
                    titulo: cityTitle || item.contact.cidade || "Contato",
                  };
                  const scanJob = scanJobs[item.contact.id];
                  const scanRunning = scanJob?.status === "running";
                  const scanDone = scanJob?.status === "done";
                  const scanBusy = Boolean(activeScanId && activeScanId !== item.contact.id);

                  return (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-700">
                      {initials(item.contact.cidade, item.contact.estado)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800">{cityTitle || "Sem cidade"}</div>
                      <div className="text-sm text-slate-500">{item.contact.nomePrefeito || "Prefeito não informado"}</div>
                    </div>
                    <StatusPill reason={item.reason} />
                  </div>

                  <div className="mt-4 grid gap-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-400">Proprietário</span>
                      <span className="text-right text-slate-700">{item.contact.proprietario || "(sem proprietário)"}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-400">Telefone atual</span>
                      <span className="text-slate-400 line-through decoration-slate-300">{item.oldValue || "Sem telefone"}</span>
                    </div>
                    <input
                      value={value}
                      onChange={(event) => {
                        setValues((prev) => ({ ...prev, [item.id]: formatPhone(event.target.value) }));
                        setWhatsappValues((prev) => ({ ...prev, [item.id]: false }));
                      }}
                      placeholder="+55 (DD) 00000-0000"
                      className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => resolve(item.id)}
                        disabled={!valid || saving === item.id}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white disabled:opacity-40"
                      >
                        <CheckIcon />
                        Corrigir
                      </button>
                      <button
                        onClick={() => handleScan(scanTarget)}
                        disabled={scanRunning || scanBusy}
                        className={`inline-flex h-9 min-w-[76px] items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-medium transition disabled:cursor-wait disabled:opacity-70 ${
                          scanDone
                            ? "border-indigo-200 bg-indigo-600 text-white shadow-sm shadow-indigo-900/10 hover:bg-indigo-700"
                            : "border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                        }`}
                      >
                        {scanDone ? <OpenIcon /> : <SearchIcon />}
                        {scanRunning ? "Buscando" : scanBusy ? "Aguarde" : scanDone ? "Abrir" : "Varredura"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {scan && (
        <ScanModal
          contactId={scan.contactId}
          titulo={scan.titulo}
          onClose={() => setScan(null)}
          onUsePhone={(phone, meta) => {
            setValues((prev) => ({ ...prev, [scan.correctionId]: formatPhone(phone) }));
            setWhatsappValues((prev) => ({ ...prev, [scan.correctionId]: meta?.hasWhatsapp === true }));
          }}
        />
      )}
    </div>
  );
}
