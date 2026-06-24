"use client";

import { usePathname } from "next/navigation";
import { logout } from "@/app/(app)/logout-action";
import { useTitle, type SavedStatus } from "@/components/TitleContext";

// Indicador discreto de salvamento ao lado do título (estilo Google Docs).
function SavedBadge({ saved }: { saved: NonNullable<SavedStatus> }) {
  if (saved.state === "saving") {
    return <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">Salvando…</span>;
  }
  if (saved.state === "error") {
    return (
      <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-amber-600">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 8v5M12 16.5v.5" strokeLinecap="round" />
          <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
        </svg>
        Falha ao salvar
      </span>
    );
  }
  const d = new Date(saved.at);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return (
    <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-slate-400">
      <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Salvo às {hora} · {data}
    </span>
  );
}

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Visão geral",
  "/bases": "Bases de Dados",
  "/correcoes": "Correção de Contatos",
  "/historico-correcoes": "Histórico de Correções",
  "/hubspot": "HubSpot CRM",
  "/configuracoes": "Configurações",
};

function fallbackTitle(pathname: string) {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  const hit = Object.keys(ROUTE_LABELS).find((r) => pathname.startsWith(r));
  return hit ? ROUTE_LABELS[hit] : "Console";
}

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "U").trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  const a = parts[0]?.[0] || "U";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
}

export default function Topbar({
  user,
  onToggle,
}: {
  user: { name?: string | null; email?: string | null };
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { title, saved } = useTitle();
  const pageTitle = title || fallbackTitle(pathname);

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      {/* Esquerda: toggle + breadcrumb + título */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onToggle}
          aria-label="Recolher menu"
          className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
          </svg>
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-semibold text-indigo-600">Console</span>
            <span className="text-slate-300">›</span>
            <span className="truncate text-slate-500">{pageTitle}</span>
          </div>
          <div className="flex items-baseline gap-3">
            <h1 className="truncate text-2xl font-bold text-slate-900">{pageTitle}</h1>
            {saved && <SavedBadge saved={saved} />}
          </div>
        </div>
      </div>

      {/* Direita: idioma, tema, usuário, sair */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
          </svg>
          <span className="hidden sm:inline">Português (BR)</span>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          aria-label="Tema"
          title="Tema"
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4 12H2m20 0h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" strokeLinecap="round" />
          </svg>
        </button>

        <div className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" />

        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
            {initials(user.name, user.email)}
          </div>
          <div className="hidden leading-tight sm:block">
            <div className="text-sm font-semibold text-slate-800">
              {user.name || "Usuário"}
            </div>
            <div className="text-xs text-slate-400">{user.email}</div>
          </div>
        </div>

        <form action={logout}>
          <button
            type="submit"
            aria-label="Sair"
            title="Sair"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 12H4m0 0 4-4m-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </header>
  );
}
