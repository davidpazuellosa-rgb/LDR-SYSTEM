import { redirect } from "next/navigation";

// O Ranking agora é uma aba de Relatórios. Mantém os links antigos funcionando.
export default async function RankingAntigo({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]).toString();
  redirect(qs ? `/relatorios/ranking?${qs}` : "/relatorios/ranking");
}
