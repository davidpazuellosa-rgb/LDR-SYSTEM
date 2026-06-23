import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: number;
  hint?: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-sm font-medium text-slate-700">{label}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  const [bases, contacts, incorreto, atualizado] = await Promise.all([
    prisma.base.count(),
    prisma.contact.count(),
    prisma.contact.count({ where: { status: "telefone_incorreto" } }),
    prisma.contact.count({ where: { status: "telefone_atualizado" } }),
  ]);

  const recent = await prisma.correction.findMany({
    where: { status: "pending" },
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { contact: true },
  });

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="space-y-8 p-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Bases" value={bases} color="text-indigo-600" hint="lotes importados/criados" />
          <StatCard label="Contatos" value={contacts} color="text-slate-800" hint="no total" />
          <StatCard label="Telefone Incorreto" value={incorreto} color="text-amber-600" hint="na fila de correção" />
          <StatCard label="Telefone Atualizado" value={atualizado} color="text-emerald-600" hint="já corrigidos" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Telefones a corrigir</h2>
              <Link href="/correcoes" className="text-sm text-indigo-600 hover:underline">
                ver tudo →
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma correção pendente. 🎉</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-700">
                      {c.contact.cidade || "(sem cidade)"}
                      {c.contact.estado ? `/${c.contact.estado}` : ""}{" "}
                      <span className="text-slate-400">— {c.oldValue || "sem telefone"}</span>
                    </span>
                    <span className="text-xs text-amber-600">{c.reason || "telefone inválido"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-800">Saúde dos dados</h2>
            <div className="space-y-3 text-sm">
              <Row label="Telefone Incorreto" value={incorreto} total={contacts} color="bg-amber-500" />
              <Row label="Telefone Atualizado" value={atualizado} total={contacts} color="bg-emerald-500" />
            </div>
            <Link
              href="/bases"
              className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Abrir bases de dados
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-500">
          {value} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
