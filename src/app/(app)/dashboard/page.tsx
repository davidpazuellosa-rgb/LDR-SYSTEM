import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/permissions";
import { ufSigla } from "@/lib/uf";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

const LDRS = ["Cecília", "Karina"] as const;
// Meta semanal padrão (placeholder). Em breve o admin define a meta por LDR (base + estado).
const META_SEMANAL = 100;

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

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // segunda = 0
  x.setDate(x.getDate() - dow);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function fmtDateTime(value: Date | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function StatCard({ label, value, hint, color }: { label: string; value: number | string; hint: string; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-slate-700">{label}</div>
      <div className="text-xs text-slate-400">{hint}</div>
    </div>
  );
}

function BarReport({ title, rows, total }: { title: string; rows: BarRow[]; total: number }) {
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
              <div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.max(4, percent(row.value, max))}%` }} />
            </div>
            {row.hint ? <div className="mt-1 text-xs text-slate-400">{row.hint}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== Visão do LDR (só os números dele) =====================
async function LdrMain({ meId, meName }: { meId: string; meName: string }) {
  const now = new Date();
  const sToday = startOfDay(now);
  const sWeek = startOfWeek(now);
  const sMonth = startOfMonth(now);
  const s14 = startOfDay(now);
  s14.setDate(s14.getDate() - 13);

  const base = { status: "resolved" as const, resolvedById: meId };
  const [total, hoje, semana, mes, fila, recentes, corr14] = await Promise.all([
    prisma.correction.count({ where: base }),
    prisma.correction.count({ where: { ...base, resolvedAt: { gte: sToday } } }),
    prisma.correction.count({ where: { ...base, resolvedAt: { gte: sWeek } } }),
    prisma.correction.count({ where: { ...base, resolvedAt: { gte: sMonth } } }),
    prisma.correction.count({ where: { status: "pending" } }),
    prisma.correction.findMany({
      where: { ...base, newValue: { not: null } },
      select: { oldValue: true, newValue: true, resolvedAt: true, contact: { select: { cidade: true, estado: true } } },
      orderBy: { resolvedAt: "desc" },
      take: 8,
    }),
    prisma.correction.findMany({ where: { ...base, resolvedAt: { gte: s14 } }, select: { resolvedAt: true } }),
  ]);

  const days: { key: string; label: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = startOfDay(now);
    d.setDate(d.getDate() - i);
    days.push({ key: d.toISOString().slice(0, 10), label: `${d.getDate()}/${d.getMonth() + 1}`, count: 0 });
  }
  const byDay = new Map(days.map((d) => [d.key, d]));
  for (const c of corr14) {
    if (!c.resolvedAt) continue;
    const e = byDay.get(new Date(c.resolvedAt).toISOString().slice(0, 10));
    if (e) e.count += 1;
  }
  const maxDay = Math.max(...days.map((d) => d.count), 1);

  const pct = Math.min(100, percent(semana, META_SEMANAL));
  const bateu = semana >= META_SEMANAL;
  const primeiro = (meName || "você").trim().split(/\s+/)[0];

  return (
    <main className="space-y-8 p-8">
      <p className="text-sm text-slate-500">
        Olá, <span className="font-medium text-slate-700">{primeiro}</span> — aqui está o seu acompanhamento.
      </p>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Corrigidos hoje" value={hoje} color="text-indigo-600" hint="telefones que você corrigiu" />
        <StatCard label="Esta semana" value={semana} color="text-slate-800" hint="desde segunda-feira" />
        <StatCard label="Este mês" value={mes} color="text-slate-800" hint="no mês atual" />
        <StatCard label="Total" value={total} color="text-emerald-600" hint="desde o início" />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Meta da semana</h2>
            <span className="text-sm text-slate-500">{semana} de {META_SEMANAL}</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${bateu ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${Math.max(3, pct)}%` }} />
          </div>
          <div className="mt-3 text-sm">
            {bateu ? (
              <span className="font-medium text-emerald-600">✓ Meta batida! Parabéns.</span>
            ) : (
              <span className="text-slate-500">
                Faltam <span className="font-medium text-slate-700">{META_SEMANAL - semana}</span> correções para bater a meta ({pct}%).
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-400">Meta padrão de {META_SEMANAL}/semana — em breve o admin define a sua meta por base e estado.</p>
        </div>

        <div className="flex flex-col justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">O que ainda falta na fila</div>
          <div className="mt-1 text-3xl font-bold text-amber-600">{fila}</div>
          <div className="text-xs text-slate-400">telefones aguardando correção</div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 font-semibold text-slate-800">Sua produção · últimos 14 dias</h2>
        <div className="flex h-32 items-end gap-1.5">
          {days.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col justify-end" title={`${d.label}: ${d.count} correção(ões)`}>
              <div className="rounded-t bg-indigo-500" style={{ height: `${Math.max(2, Math.round((d.count / maxDay) * 100))}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-400">
          <span>há 14 dias</span>
          <span>hoje</span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-800">Suas últimas correções</h2>
        {recentes.length === 0 ? (
          <p className="text-sm text-slate-400">Você ainda não corrigiu nenhum telefone. Abra a Correção de Contatos para começar.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="py-2 font-medium">Cidade</th>
                <th className="py-2 font-medium">De → Para</th>
                <th className="py-2 text-right font-medium">Quando</th>
              </tr>
            </thead>
            <tbody>
              {recentes.map((c, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-2 text-slate-700">{[c.contact.cidade, ufSigla(c.contact.estado)].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="py-2 text-slate-500">{c.oldValue || "—"} → {c.newValue}</td>
                  <td className="py-2 text-right text-slate-400">{fmtDateTime(c.resolvedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

// ===================== Visão do Admin (geral, todos os LDRs) =====================
async function AdminMain() {
  const [bases, contacts, incorreto, atualizado, ldrContacts, resolvedCorrections, pendingCorrections] = await Promise.all([
    prisma.base.count(),
    prisma.contact.count({ where: { deletedAt: null } }),
    prisma.contact.count({ where: { status: "telefone_incorreto", deletedAt: null } }),
    prisma.contact.count({ where: { status: "telefone_atualizado", deletedAt: null } }),
    prisma.contact.findMany({
      where: { deletedAt: null },
      select: { id: true, status: true, createdAt: true, prospectante: true, proprietario: true, createdBy: { select: { name: true, email: true } } },
    }),
    prisma.correction.findMany({
      where: { status: "resolved", newValue: { not: null }, resolvedAt: { not: null } },
      select: { id: true, resolvedAt: true, resolvedBy: { select: { name: true, email: true } }, contact: { select: { prospectante: true, proprietario: true } } },
    }),
    prisma.correction.findMany({ where: { status: "pending" }, select: { id: true, contact: { select: { prospectante: true, proprietario: true } } } }),
  ]);

  const addedByLdr = LDRS.map((name, index) => ({
    label: name,
    value: ldrContacts.filter((c) => matchesLdr(name, c.createdBy?.name, c.createdBy?.email, c.prospectante, c.proprietario)).length,
    color: index === 0 ? "bg-indigo-500" : "bg-emerald-500",
    hint: "por usuário ou responsável",
  }));
  const updatedByLdr = LDRS.map((name, index) => ({
    label: name,
    value: resolvedCorrections.filter((c) => matchesLdr(name, c.resolvedBy?.name, c.resolvedBy?.email, c.contact.prospectante, c.contact.proprietario)).length,
    color: index === 0 ? "bg-indigo-500" : "bg-emerald-500",
    hint: "por correções resolvidas",
  }));
  const pendingByLdr = LDRS.map((name, index) => ({
    label: name,
    value: pendingCorrections.filter((c) => matchesLdr(name, c.contact.prospectante, c.contact.proprietario)).length,
    color: index === 0 ? "bg-amber-500" : "bg-orange-500",
    hint: "na fila atual",
  }));

  const addedTotal = addedByLdr.reduce((sum, row) => sum + row.value, 0);
  const updatedTotal = updatedByLdr.reduce((sum, row) => sum + row.value, 0);
  const pendingLdrTotal = pendingByLdr.reduce((sum, row) => sum + row.value, 0);
  const addedLast7 = ldrContacts.filter((c) => lastDays(c.createdAt, 7)).length;
  const updatedLast7 = resolvedCorrections.filter((c) => lastDays(c.resolvedAt, 7)).length;
  const correctionRate = contacts ? `${percent(atualizado, atualizado + incorreto)}%` : "0%";

  return (
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
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const u = (session?.user || {}) as { id?: string; role?: string; name?: string | null };
  const admin = isAdmin(u.role);

  return (
    <>
      <PageHeader title="Dashboard" />
      {admin ? <AdminMain /> : <LdrMain meId={u.id || ""} meName={u.name || "você"} />}
    </>
  );
}
