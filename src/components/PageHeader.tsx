"use client";

import { PageTitle } from "@/components/TitleContext";

// Título visual da página e sincronização com o Topbar.
export default function PageHeader({
  title,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return <PageTitle title={title} />;
}
