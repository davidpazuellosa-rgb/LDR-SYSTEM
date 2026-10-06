import Link from "next/link";

// Abas do módulo Relatórios (server component simples).
export default function RelatoriosTabs({ ativa }: { ativa: "geral" | "producao" | "ranking" }) {
  const cls = (on: boolean) =>
    `-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${on ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`;
  return (
    <div className="flex gap-1 border-b border-slate-200">
      <Link href="/relatorios" className={cls(ativa === "geral")}>Visão geral</Link>
      <Link href="/relatorios/producao" className={cls(ativa === "producao")}>Produção por pessoa</Link>
      <Link href="/ranking" className={cls(ativa === "ranking")}>Ranking</Link>
    </div>
  );
}
