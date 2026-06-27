"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";
import { ufSigla } from "@/lib/uf";
import ScanModal from "@/components/ScanModal";
import { useToast } from "@/components/Toast";
import { isCampanhaAtiva } from "@/lib/campanhas";

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

// Devolve a posição do cursor logo após `n` dígitos no valor formatado — assim dá
// pra editar qualquer dígito no meio sem o cursor pular pro fim a cada tecla.
function caretFromDigitCount(formatted: string, n: number): number {
  if (n <= 0) return PHONE_PREFIX.length;
  let count = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      count += 1;
      if (count >= n) return i + 1;
    }
  }
  return formatted.length;
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

// Chave Sim/Não reutilizável (ex.: "Tem WhatsApp", "Contato institucional").
function SimNaoToggle({
  label,
  value,
  onChange,
  tone = "indigo",
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  tone?: "indigo" | "emerald";
}) {
  // Tons pastel (suaves, menos neon): fundo claro da cor + texto escuro.
  // WhatsApp (tone emerald): Sim verde, Não vermelho. Institucional: âmbar nos dois.
  const yesActive = tone === "emerald" ? "bg-emerald-100 text-emerald-700 shadow-sm" : "bg-amber-100 text-amber-700 shadow-sm";
  const noActive = tone === "emerald" ? "bg-rose-100 text-rose-700 shadow-sm" : "bg-amber-100 text-amber-700 shadow-sm";
  const idle = "text-slate-500 hover:text-slate-700";
  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="inline-flex items-center rounded-full bg-slate-100 p-0.5 text-xs font-medium">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`rounded-full px-3.5 py-1 transition ${value ? yesActive : idle}`}
        >
          Sim
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded-full px-3.5 py-1 transition ${!value ? noActive : idle}`}
        >
          Não
        </button>
      </div>
    </div>
  );
}

// Quando "Contato institucional" = Não, pede nome + cargo da pessoa antes de corrigir.
function PessoaModal({
  titulo,
  onClose,
  onConfirm,
}: {
  titulo: string;
  onClose: () => void;
  onConfirm: (nome: string, cargo: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const ready = nome.trim().length > 0 && cargo.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Dados do contato</h2>
            <p className="mt-1 text-xs text-slate-400">{titulo}</p>
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

        <div className="space-y-4 p-6">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">Nome da pessoa</span>
            <input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              autoFocus
              placeholder="Ex.: Jorge"
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">Cargo da pessoa</span>
            <input
              value={cargo}
              onChange={(event) => setCargo(event.target.value)}
              placeholder="Ex.: Secretário de Administração"
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(nome.trim(), cargo.trim())}
            disabled={!ready}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirmar correção
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CorrectionsList({ items }: { items: CorrectionItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [whatsappValues, setWhatsappValues] = useState<Record<string, boolean>>({});
  const [institucionalValues, setInstitucionalValues] = useState<Record<string, boolean>>({});
  const [naoEncontradoValues, setNaoEncontradoValues] = useState<Record<string, boolean>>({});
  const [pessoaModal, setPessoaModal] = useState<{ id: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanTarget | null>(null);
  const [scanJobs, setScanJobs] = useState<Record<string, ScanJob>>({});
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const activeScanRef = useRef<string | null>(null);
  const [campanha, setCampanha] = useState<string | null>(null);
  const [regiao, setRegiao] = useState<string | null>(null);
  const [owner, setOwner] = useState("all");

  const campanhas = useMemo(
    () => uniq(items.map((item) => item.contact.campanha)).filter(isCampanhaAtiva),
    [items],
  );

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

  // Formata o telefone PRESERVANDO o cursor: dá pra editar qualquer dígito no
  // meio sem precisar apagar tudo.
  function handlePhoneInput(id: string, el: HTMLInputElement) {
    const raw = el.value;
    const caret = el.selectionStart ?? raw.length;
    const digitsBefore = raw.slice(0, caret).replace(/\D/g, "").length;
    const formatted = formatPhone(raw);
    setValues((prev) => ({ ...prev, [id]: formatted }));
    setWhatsappValues((prev) => ({ ...prev, [id]: false }));
    requestAnimationFrame(() => {
      const pos = caretFromDigitCount(formatted, digitsBefore);
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        // input pode não estar mais montado — ignora
      }
    });
  }

  // Decide o caminho ao clicar em Corrigir: se NÃO for contato institucional,
  // abre o formulário (nome + cargo) antes de enviar; senão envia direto.
  function resolve(id: string) {
    // "Número não encontrado": fecha o item sem exigir telefone.
    if (naoEncontradoValues[id]) {
      submitNaoEncontrado(id);
      return;
    }
    if (localDigits(values[id]).length < 10) {
      toast.error("Digite um telefone válido com DDD.");
      return;
    }
    if (institucionalValues[id] === false) {
      setPessoaModal({ id });
      return;
    }
    submitCorrection(id, { institucional: true });
  }

  // Marca o contato como "número não encontrado": sai da fila e NÃO conta na meta.
  async function submitNaoEncontrado(id: string) {
    setSaving(id);
    const loadingId = toast.loading("Marcando como não encontrado...");
    try {
      const res = await fetch(apiPath(`/api/corrections/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naoEncontrado: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.dismiss(loadingId);
        toast.success("Marcado como número não encontrado.", "Saiu da fila — não conta como ponto na meta.");
        router.refresh();
      } else {
        toast.dismiss(loadingId);
        toast.error("Não foi possível marcar.", data.error || `HTTP ${res.status}.`);
      }
    } catch (error) {
      toast.dismiss(loadingId);
      toast.error("Não foi possível marcar.", (error as Error).message);
    } finally {
      setSaving(null);
    }
  }

  async function submitCorrection(
    id: string,
    extra: { institucional: boolean; pessoaNome?: string; pessoaCargo?: string },
  ) {
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
        body: JSON.stringify({
          newValue,
          hasWhatsapp: whatsappValues[id] === true,
          institucional: extra.institucional,
          pessoaNome: extra.pessoaNome,
          pessoaCargo: extra.pessoaCargo,
        }),
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
              <div className="min-w-[1210px]">
                <div className="grid grid-cols-[minmax(280px,1.25fr)_minmax(170px,.75fr)_180px_400px_250px] border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <div className="px-5 py-3">Prefeitura</div>
                  <div className="px-4 py-3">Proprietário</div>
                  <div className="px-4 py-3">Telefone atual</div>
                  <div className="px-4 py-3">Novo número</div>
                  <div className="px-4 py-3 text-right">Ações</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {shown.map((item) => {
                  const cityTitle = [item.contact.cidade, ufSigla(item.contact.estado)].filter(Boolean).join(" / ");
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
                        className="grid grid-cols-[minmax(280px,1.25fr)_minmax(170px,.75fr)_180px_400px_250px] items-center bg-white transition hover:bg-slate-50/80"
                      >
                        <div className="flex min-w-0 items-center gap-3 px-5 py-4">
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-700">
                            {initials(item.contact.cidade, ufSigla(item.contact.estado))}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-slate-800">{item.contact.cidade || "Sem cidade"}</div>
                            <div className="truncate text-sm text-slate-500">{item.contact.nomePrefeito || "Prefeito não informado"}</div>
                          </div>
                        </div>

                        <div className="min-w-0 px-4 py-4 text-sm text-slate-600">
                          <div className="truncate">{item.contact.proprietario || "(sem proprietário)"}</div>
                        </div>

                        <div className="px-4 py-4 text-sm text-slate-400 line-through decoration-slate-300">
                          {item.oldValue || "Sem telefone"}
                        </div>

                        <div className="flex items-center gap-4 px-4 py-4">
                          <div className="w-44 shrink-0">
                            <input
                              value={value}
                              onChange={(event) => handlePhoneInput(item.id, event.currentTarget)}
                              onFocus={(event) => {
                                if (!values[item.id]) {
                                  setValues((prev) => ({ ...prev, [item.id]: PHONE_PREFIX }));
                                  requestAnimationFrame(() => event.currentTarget.setSelectionRange(PHONE_PREFIX.length, PHONE_PREFIX.length));
                                }
                              }}
                              disabled={naoEncontradoValues[item.id] === true}
                              placeholder="+55 (DD) 00000-0000"
                              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:line-through"
                            />
                          </div>
                          <div className="flex flex-1 flex-col gap-3 border-l border-slate-100 pl-4">
                            <SimNaoToggle
                              label="Tem WhatsApp"
                              tone="emerald"
                              value={whatsappValues[item.id] === true}
                              onChange={(v) => setWhatsappValues((prev) => ({ ...prev, [item.id]: v }))}
                            />
                            <SimNaoToggle
                              label="Contato institucional"
                              value={institucionalValues[item.id] !== false}
                              onChange={(v) => setInstitucionalValues((prev) => ({ ...prev, [item.id]: v }))}
                            />
                            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
                              <input
                                type="checkbox"
                                checked={naoEncontradoValues[item.id] === true}
                                onChange={(e) => setNaoEncontradoValues((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                                className="h-4 w-4 rounded border-slate-300 text-zinc-600 focus:ring-zinc-400"
                              />
                              Número não encontrado
                            </label>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-4 py-4">
                          <button
                            onClick={() => resolve(item.id)}
                            disabled={(!valid && naoEncontradoValues[item.id] !== true) || saving === item.id}
                            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
                              naoEncontradoValues[item.id] ? "bg-zinc-600 hover:bg-zinc-700" : "bg-emerald-600 hover:bg-emerald-700"
                            }`}
                          >
                            <CheckIcon />
                            {saving === item.id ? "Salvando" : naoEncontradoValues[item.id] ? "Não encontrado" : "Corrigir"}
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
                  const cityTitle = [item.contact.cidade, ufSigla(item.contact.estado)].filter(Boolean).join(" / ");
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
                    <div className="flex flex-col gap-3">
                      <input
                        value={value}
                        onChange={(event) => handlePhoneInput(item.id, event.currentTarget)}
                        disabled={naoEncontradoValues[item.id] === true}
                        placeholder="+55 (DD) 00000-0000"
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:line-through"
                      />
                      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                        <SimNaoToggle
                          label="Tem WhatsApp"
                          tone="emerald"
                          value={whatsappValues[item.id] === true}
                          onChange={(v) => setWhatsappValues((prev) => ({ ...prev, [item.id]: v }))}
                        />
                        <SimNaoToggle
                          label="Contato institucional"
                          value={institucionalValues[item.id] !== false}
                          onChange={(v) => setInstitucionalValues((prev) => ({ ...prev, [item.id]: v }))}
                        />
                      </div>
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
                        <input
                          type="checkbox"
                          checked={naoEncontradoValues[item.id] === true}
                          onChange={(e) => setNaoEncontradoValues((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                          className="h-4 w-4 rounded border-slate-300 text-zinc-600 focus:ring-zinc-400"
                        />
                        Número não encontrado
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => resolve(item.id)}
                        disabled={(!valid && naoEncontradoValues[item.id] !== true) || saving === item.id}
                        className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white disabled:opacity-40 ${
                          naoEncontradoValues[item.id] ? "bg-zinc-600" : "bg-emerald-600"
                        }`}
                      >
                        <CheckIcon />
                        {naoEncontradoValues[item.id] ? "Não encontrado" : "Corrigir"}
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

      {pessoaModal &&
        (() => {
          const item = items.find((i) => i.id === pessoaModal.id);
          const titulo =
            (item && ([item.contact.cidade, ufSigla(item.contact.estado)].filter(Boolean).join(" / ") || item.contact.cidade)) ||
            "Contato";
          return (
            <PessoaModal
              titulo={titulo}
              onClose={() => setPessoaModal(null)}
              onConfirm={(nome, cargo) => {
                const id = pessoaModal.id;
                setPessoaModal(null);
                submitCorrection(id, { institucional: false, pessoaNome: nome, pessoaCargo: cargo });
              }}
            />
          );
        })()}
    </div>
  );
}
