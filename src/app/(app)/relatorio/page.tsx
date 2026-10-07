import { redirect } from "next/navigation";

// O relatório do operador agora vive em Relatórios (mesmas abas para todos os cargos).
// Mantém os links antigos (/relatorio?aba=...&periodo=...) funcionando.
const DESTINO: Record<string, string> = {
  desempenho: "/relatorios",
  horarios: "/relatorios/horarios",
  ranking: "/relatorios/ranking",
  correcoes: "/relatorios/correcoes",
};

export default async function RelatorioAntigo({ searchParams }: { searchParams: Promise<{ aba?: string; periodo?: string }> }) {
  const sp = await searchParams;
  const base = DESTINO[sp.aba || ""] ?? "/relatorios";
  redirect(sp.periodo && sp.periodo !== "7d" && base !== "/relatorios/correcoes" ? `${base}?periodo=${encodeURIComponent(sp.periodo)}` : base);
}
