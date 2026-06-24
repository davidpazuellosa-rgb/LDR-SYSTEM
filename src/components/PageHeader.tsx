"use client";

import { PageTitle } from "@/components/TitleContext";

// Título visual da página e sincronização com o Topbar.
export default function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  if (!action) return <PageTitle title={title} />;
  return (
    <div className="flex items-center justify-between gap-4 px-8 pt-6 pb-2">
      <PageTitle title={title} />
      <div className="shrink-0">{action}</div>
    </div>
  );
}
