import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

const LDRS = ["Cecília", "Karina"] as const;

type BarRow = {
  label: string;
  value: number;
  color: string;
  hint?: string;
};

function normalizeName(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesLdr(ldr: string, ...values: Array<string | null | undefined>) {
  const needle = normalizeName(ldr);
  return values.some((value) => normalizeName(value).includes(needle));
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function lastDays(date: Date | null | undefined, days: number) {
  if (!date) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

function StatCard({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: number | string;
  hint: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-slate-700">{label}</div>
      <div className="text-xs text-slate-400">{hint}</div>
    </div>
  );
}

function BarReport({
  title,
  rows,
  total,
}: {
  title: string;
  rows: BarRow[];
  total: number;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <span className="text-sm text-slate-400">{total} no total</span>
      </div>

      <div className="space-y-5">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-2 flex items-center justify-between gap-4 text-sm">
              <span className="font-medium text-slate-600">{row.label}</span>
              <span className="text-slate-500">
                {row.value} ({percent(row.value, total)}%)
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${row.color}`}
                style={{ width: `${Math.max(4, percent(row.value, max))}%` }}
              />
            </div>
            {row.hint ? <div className="mt-1 text-xs text-slate-400">{row.hint}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const [bases, contacts, incorreto, atualizado, ldrContacts, resolvedCorrections, pendingCorrections] =
    await Promise.all([
      prisma.base.count(),
      prisma.contact.count({ where: { deletedAt: null } }),
      prisma.contact.count({ where: { status: "telefone_incorreto", deletedAt: null } }),
      prisma.contact.count({ where: { status: "telefone_atualizado", deletedAt: null } }),
      prisma.contact.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          status: true,
          createdAt: true,
          prospectante: true,
          proprietario: true,
          createdBy: { select: { name: true, email: true } },
        },
      }),
      prisma.correction.findMany({
        where: {
          status: "resolved",
          newValue: { not: null },
          resolvedAt: { not: null },
        },
        select: {
          id: true,
          resolvedAt: true,
          resolvedBy: { select: { name: true, email: true } },
          contact: { select: { prospectante: true, proprietario: true } },
        },
      }),
      prisma.correction.findMany({
        where: { status: "pending" },
        select: {
          id: true,
          contact: { select: { prospectante: true, proprietario: true } },
        },
      }),
    ]);

  const addedByLdr = LDRS.map((name, index) => ({
    label: name,
    value: ldrContacts.filter((contact) =>
      matchesLdr(name, contact.createdBy?.name, contact.createdBy?.email, contact.prospectante, contact.proprietario),
    ).length,
    color: index === 0 ? "bg-indigo-500" : "bg-emerald-500",
    hint: "por usuário ou responsável",
  }));

  const updatedByLdr = LDRS.map((name, index) => ({
    label: name,
    value: resolvedCorrections.filter((correction) =>
      matchesLdr(
        name,
        correction.resolvedBy?.name,
        correction.resolvedBy?.email,
        correction.contact.prospectante,
        correction.contact.proprietario,
      ),
    ).length,
    color: index === 0 ? "bg-indigo-500" : "bg-emerald-500",
    hint: "por correções resolvidas",
  }));

  const pendingByLdr = LDRS.map((name, index) => ({
    label: name,
    value: pendingCorrections.filter((correction) =>
      matchesLdr(name, correction.contact.prospectante, correction.contact.proprietario),
    ).length,
    color: index === 0 ? "bg-amber-500" : "bg-orange-500",
    hint: "na fila atual",
  }));

  const addedTotal = addedByLdr.reduce((sum, row) => sum + row.value, 0);
  const updatedTotal = updatedByLdr.reduce((sum, row) => sum + row.value, 0);
  const pendingLdrTotal = pendingByLdr.reduce((sum, row) => sum + row.value, 0);
  const addedLast7 = ldrContacts.filter((contact) => lastDays(contact.createdAt, 7)).length;
  const updatedLast7 = resolvedCorrections.filter((correction) => lastDays(correction.resolvedAt, 7)).length;
  const correctionRate = contacts ? `${percent(atualizado, atualizado + incorreto)}%` : "0%";

  return (
    <>
      <PageHeader title="Dashboard" />
      <main className="space-y-8 p-8">
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Bases" value={bases} color="text-indigo-600" hint="lotes importados/criados" />
          <StatCard label="Contatos" value={contacts} color="text-slate-800" hint="no total" />
          <StatCard label="Telefone Incorreto" value={incorreto} color="text-amber-600" hint="na fila de correção" />
          <StatCard label="Telefone Atualizado" value={atualizado} color="text-emerald-600" hint="já corrigidos" />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BarReport title="Contatos adicionados por LDR" rows={addedByLdr} total={addedTotal} />
          <BarReport title="Números atualizados por LDR" rows={updatedByLdr} total={updatedTotal} />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <BarReport title="Fila por LDR" rows={pendingByLdr} total={pendingLdrTotal} />

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="mb-5 font-semibold text-slate-800">Acompanhamento LDR</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="border-l-4 border-slate-200 pl-4">
                <div className="text-2xl font-bold text-slate-800">{addedLast7}</div>
                <div className="mt-1 text-sm text-slate-600">Contatos novos</div>
                <div className="text-xs text-slate-400">últimos 7 dias</div>
              </div>
              <div className="border-l-4 border-emerald-200 pl-4">
                <div className="text-2xl font-bold text-emerald-600">{updatedLast7}</div>
                <div className="mt-1 text-sm text-slate-600">Números atualizados</div>
                <div className="text-xs text-slate-400">últimos 7 dias</div>
              </div>
              <div className="border-l-4 border-indigo-200 pl-4">
                <div className="text-2xl font-bold text-indigo-600">{correctionRate}</div>
                <div className="mt-1 text-sm text-slate-600">Taxa de correção</div>
                <div className="text-xs text-slate-400">atualizados vs. fila</div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {LDRS.map((name) => {
                const added = addedByLdr.find((row) => row.label === name)?.value || 0;
                const updated = updatedByLdr.find((row) => row.label === name)?.value || 0;
                const pending = pendingByLdr.find((row) => row.label === name)?.value || 0;

                return (
                  <div key={name} className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                    <span className="font-medium text-slate-700">{name}</span>
                    <span className="text-slate-500">
                      {added} adicionados · {updated} atualizados · {pending} pendentes
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
