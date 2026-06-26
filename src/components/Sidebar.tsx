"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SasiLogo from "@/components/SasiLogo";

type Badges = { bases: number; pending: number; sugestoes: number; metasStatus: "ok" | "risco" | "atrasado" | null; metaNova: boolean };

function Icon({ name }: { name: string }) {
  const common = "h-5 w-5";
  switch (name) {
    case "grid":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "database":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
          <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
        </svg>
      );
    case "phone":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l-2 6a2 2 0 0 1-2 1A16 16 0 0 1 4 6a2 2 0 0 1 1-2Z" strokeLinejoin="round" />
        </svg>
      );
    case "target":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="0.6" fill="currentColor" />
        </svg>
      );
    case "chart":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 4v16h16" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="7" y="11" width="3" height="6" rx="0.5" />
          <rect x="12" y="7" width="3" height="10" rx="0.5" />
          <rect x="17" y="13" width="3" height="4" rx="0.5" />
        </svg>
      );
    case "history":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
          <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "link":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M10 14a4 4 0 0 0 6 .5l2.5-2.5a4 4 0 0 0-5.7-5.7L11.5 8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 10a4 4 0 0 0-6-.5L5.5 12a4 4 0 0 0 5.7 5.7L12.5 16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "gear":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3 1a7 7 0 0 0-1.7-1L14.5 2h-5l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.5L5 11a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.3-1a7 7 0 0 0 1.7 1l.4 2.5h5l.4-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.5-2-1.5a7 7 0 0 0 .1-1Z" strokeLinejoin="round" />
        </svg>
      );
    case "users":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
          <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 20a5.5 5.5 0 0 0-2.3-4.5" strokeLinecap="round" />
        </svg>
      );
    case "bulb":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 18h6M10 21h4" strokeLinecap="round" />
          <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2H14.5c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Sidebar({
  collapsed,
  badges,
  role,
}: {
  collapsed: boolean;
  badges: Badges;
  role: string;
}) {
  const pathname = usePathname();
  const admin = role === "admin";

  // Ponto colorido em "Minhas Metas" conforme a pior situação das metas do usuário.
  const metaDot =
    badges.metasStatus === "atrasado" ? "bg-rose-500"
    : badges.metasStatus === "risco" ? "bg-amber-400"
    : badges.metasStatus === "ok" ? "bg-emerald-500"
    : "";

  const nav: { href: string; label: string; icon: string; badge: number; dot?: string; pulse?: boolean }[] = [
    { href: "/dashboard", label: "Visão geral", icon: "grid", badge: 0 },
    { href: "/minhas-metas", label: admin ? "Metas da Equipe" : "Minhas Metas", icon: "target", badge: 0, dot: metaDot || (badges.metaNova ? "bg-indigo-400" : ""), pulse: badges.metaNova },
    ...(admin ? [{ href: "/relatorios", label: "Relatórios", icon: "chart", badge: 0 }] : []),
    { href: "/bases", label: "Bases de Dados", icon: "database", badge: 0 },
    { href: "/correcoes", label: "Correção de Contatos", icon: "phone", badge: 0 },
    { href: "/historico-correcoes", label: "Histórico de Correções", icon: "history", badge: 0 },
    // Áreas sensíveis: só admin
    ...(admin ? [{ href: "/usuarios", label: "Usuários", icon: "users", badge: 0 }] : []),
    ...(admin ? [{ href: "/sugestoes", label: "Sugestões de Melhoria", icon: "bulb", badge: badges.sugestoes }] : []),
    { href: "/configuracoes", label: "Configurações", icon: "gear", badge: 0 },
  ];

  return (
    <aside
      className={`flex shrink-0 flex-col bg-[#191d45] text-white transition-all duration-200 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Logo + tag */}
      <div className="flex h-16 items-center gap-2 px-5">
        <SasiLogo height={26} className="text-white" />
        {!collapsed && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-300">
            LDR Hub
          </span>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <span className="relative">
                <Icon name={item.icon} />
                {collapsed && item.badge > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#191d45] bg-indigo-400" />
                )}
                {collapsed && item.dot && (
                  <span className={`absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#191d45] ${item.dot} ${item.pulse ? "animate-pulse" : ""}`} />
                )}
              </span>
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && item.pulse && <span className="text-[10px] font-semibold text-indigo-300">nova</span>}
              {!collapsed && item.dot && <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot} ${item.pulse ? "animate-pulse ring-2 ring-indigo-400/40" : ""}`} />}
              {!collapsed && item.badge > 0 && (
                <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-indigo-500 px-1.5 text-[11px] font-semibold text-white">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Suporte + rodapé */}
      <div className="border-t border-white/10 px-3 py-4">
        <a
          href="mailto:suporte@sasi.com?subject=Suporte%20LDR%20Hub"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white ${
            collapsed ? "justify-center" : ""
          }`}
          title="Suporte SASI"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3.5" />
            <path d="m5 5 4 4m6 6 4 4M19 5l-4 4M9 15l-4 4" strokeLinecap="round" />
          </svg>
          {!collapsed && "Suporte SASI"}
        </a>
        {!collapsed && (
          <div className="mt-4 px-3 text-[11px] leading-relaxed text-slate-500">
            SASI LDR Hub · v1.0.0
            <br />© 2026 SASI LTDA
          </div>
        )}
      </div>
    </aside>
  );
}
