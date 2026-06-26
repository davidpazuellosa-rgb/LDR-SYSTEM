"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { TitleProvider } from "@/components/TitleContext";
import { ToastProvider } from "@/components/Toast";
import SystemAssistant from "@/components/SystemAssistant";
import SuggestionButton from "@/components/SuggestionButton";

export default function AppShell({
  user,
  role,
  badges,
  children,
}: {
  user: { name?: string | null; email?: string | null };
  role: string;
  badges: { bases: number; pending: number; sugestoes: number; metasStatus: "ok" | "risco" | "atrasado" | null; metaNova: boolean };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Ao entrar numa planilha (/bases/[id]) recolhe a sidebar para dar mais espaço;
  // fora dela volta expandida. O botão de alternar continua funcionando.
  useEffect(() => {
    setCollapsed(/^\/bases\/[^/]+/.test(pathname));
  }, [pathname]);

  return (
    <TitleProvider>
      <ToastProvider>
      {/* Shell preso à viewport: a sidebar e o topo NUNCA rolam;
          apenas a área central (<main>) tem rolagem própria. */}
      <div className="fixed inset-0 flex overflow-hidden bg-slate-100">
        <Sidebar collapsed={collapsed} badges={badges} role={role} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Topbar user={user} onToggle={() => setCollapsed((v) => !v)} />
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
        </div>
        <SystemAssistant />
        <SuggestionButton />
      </div>
      </ToastProvider>
    </TitleProvider>
  );
}
