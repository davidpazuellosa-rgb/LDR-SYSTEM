"use client";

import { PageTitle, type Trilha } from "@/components/TitleContext";

// Título visual da página e sincronização com o Topbar.
export default function PageHeader({
  title,
  action,
  trail,
}: {
  title: string;
  trail?: Trilha;
  action?: React.ReactNode;
}) {
  if (!action) return <PageTitle title={title} trail={trail} />;
  return (
    <div className="flex items-center justify-between gap-4 px-8 pt-6 pb-2">
      <PageTitle title={title} trail={trail} />
      <div className="shrink-0">{action}</div>
    </div>
  );
}
