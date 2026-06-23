"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { TitleProvider } from "@/components/TitleContext";
import { ToastProvider } from "@/components/Toast";

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
      <div className="flex min-h-screen flex-1 bg-slate-100">
        <Sidebar collapsed={collapsed} badges={badges} role={role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={user} onToggle={() => setCollapsed((v) => !v)} />
          <main className="flex-1 overflow-x-hidden">{children}</main>
        </div>
      </div>
      </ToastProvider>
    </TitleProvider>
  );
}
