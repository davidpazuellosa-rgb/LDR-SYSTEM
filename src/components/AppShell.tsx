"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { TitleProvider } from "@/components/TitleContext";
import { ToastProvider } from "@/components/Toast";
import SystemAssistant from "@/components/SystemAssistant";

export default function AppShell({
  user,
  role,
  badges,
  children,
}: {
  user: { name?: string | null; email?: string | null };
  role: string;
  badges: { bases: number; pending: number };
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

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
      </div>
      </ToastProvider>
    </TitleProvider>
  );
}
