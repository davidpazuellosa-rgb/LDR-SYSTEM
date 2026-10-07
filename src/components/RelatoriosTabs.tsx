import Link from "next/link";

export type AbaRelatorio = "geral" | "producao" | "horarios" | "validacao" | "ranking" | "correcoes";

// Abas do módulo Relatórios — as MESMAS rotas para todos os cargos. O admin vê a equipe
// (e "Desempenho" = produção por pessoa); LDR/Pré-vendedor veem só o que é deles, e o
// Ranking é a única aba com dados da equipe. (server component simples)
export default function RelatoriosTabs({ ativa, admin }: { ativa: AbaRelatorio; admin: boolean }) {
  const abas: { v: AbaRelatorio; label: string; href: string }[] = [
    { v: "geral", label: "Visão geral", href: "/relatorios" },
    ...(admin ? [{ v: "producao" as const, label: "Desempenho", href: "/relatorios/producao" }] : []),
    { v: "horarios", label: "Horários", href: "/relatorios/horarios" },
    { v: "validacao", label: "Validação", href: "/relatorios/validacao" },
    { v: "ranking", label: "Ranking", href: "/relatorios/ranking" },
    { v: "correcoes", label: "Correções", href: admin ? "/historico-correcoes" : "/relatorios/correcoes" },
  ];
  const cls = (on: boolean) =>
    `-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${on ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`;
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200">
      {abas.map((a) => (
        <Link key={a.v} href={a.href} className={cls(ativa === a.v)}>{a.label}</Link>
      ))}
    </div>
  );
}
