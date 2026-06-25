import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/permissions";
import { ufSigla } from "@/lib/uf";
import { tipoOrgao } from "@/lib/completude";
import { ensureMetaTable } from "@/lib/meta";
import { ensureContactFillTable } from "@/lib/contact-fill";
import { metaFeito, startOfDay, startOfWeek, startOfMonth, type Meta, type Fill, type CorrDone } from "@/lib/meta-progress";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}
function fmtDateTime(value: Date | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
const prazoLabel = (prazo: string) => (prazo === "mensal" ? "este mês" : "esta semana");

async function loadProgress(): Promise<{ fills: Fill[]; corrections: CorrDone[] }> {
  await ensureContactFillTable();
  const [contacts, fillRows, corrections] = await Promise.all([
    prisma.contact.findMany({ where: { deletedAt: null }, select: { id: true, baseId: true, regiao: true, estado: true } }),
    prisma.contactFill.findMany({ select: { contactId: true, concluidoEm: true } }),
    prisma.correction
      .findMany({
        where: { status: "resolved", resolvedAt: { not: null } },
        select: { resolvedById: true, resolvedAt: true, contact: { select: { campanha: true } } },
      })
      .then((rows) => rows.map((r) => ({ resolvedById: r.resolvedById, resolvedAt: r.resolvedAt, campanha: r.contact.campanha }))),
  ]);
  // Junta cada conclusão ao território (base/região/estado) do seu contato.
  const terr = new Map(contacts.map((c) => [c.id, c]));
  const fills: Fill[] = [];
  for (const f of fillRows) {
    const c = terr.get(f.contactId);
    if (c) fills.push({ concluidoEm: f.concluidoEm, baseId: c.baseId, regiao: c.regiao, estado: c.estado });
  }
  return { fills, corrections };
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

function MetaBar({ label, sub, feito, alvo }: { label: string; sub: string; feito: number; alvo: number }) {
  const pct = alvo ? Math.min(100, percent(feito, alvo)) : feito > 0 ? 100 : 0;
  const bateu = alvo > 0 && feito >= alvo;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium text-slate-700">{label}</span>
        <span className="shrink-0 text-slate-500">
          {feito}
          {alvo ? ` / ${alvo}` : ""} {alvo ? `(${pct}%)` : ""}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${bateu ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${Math.max(3, pct)}%` }} />
      </div>
      <div className="mt-1 text-xs text-slate-400">{sub}</div>
    </div>
  );
}

function fillLabel(m: Meta, baseName: (id: string | null) => string) {
  return `${tipoOrgao(baseName(m.baseId))} · ${m.regiao} · ${m.estado}`;
}

// ===================== Visão do LDR =====================
async function LdrMain({ meId, meName }: { meId: string; meName: string }) {
  await ensureMetaTable();
  const now = new Date();
  const sToday = startOfDay(now);
  const sWeek = startOfWeek(now);
  const sMonth = startOfMonth(now);
  const s14 = startOfDay(now);
  s14.setDate(s14.getDate() - 13);

  const base = { status: "resolved" as const, resolvedById: meId };
  const [total, hoje, semana, mes, fila, recentes, corr14, metas, bases, progress] = await Promise.all([
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
    prisma.meta.findMany({ where: { userId: meId } }) as Promise<Meta[]>,
    prisma.base.findMany({ select: { id: true, name: true } }),
    loadProgress(),
  ]);

  const baseName = (id: string | null) => bases.find((b) => b.id === id)?.name || "Base";
  const fillMetas = metas.filter((m) => m.tipo !== "correcao");
  const corrMetas = metas.filter((m) => m.tipo === "correcao");

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

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-800">Minhas metas de preenchimento</h2>
          {fillMetas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma meta de preenchimento definida. O admin define em Usuários.</p>
          ) : (
            <div className="space-y-4">
              {fillMetas.map((m) => (
                <MetaBar key={m.id} label={fillLabel(m, baseName)} sub={`prefeituras completas ${prazoLabel(m.prazo)}`} feito={metaFeito(m, now, progress.fills, progress.corrections)} alvo={m.alvo} />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-800">Minhas metas de correção</h2>
            <span className="text-sm text-slate-400">{fila} na fila</span>
          </div>
          {corrMetas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma meta de correção definida. O admin define em Usuários.</p>
          ) : (
            <div className="space-y-4">
              {corrMetas.map((m) => (
                <MetaBar key={m.id} label={m.campanha || "Campanha"} sub={`contatos corrigidos ${prazoLabel(m.prazo)}`} feito={metaFeito(m, now, progress.fills, progress.corrections)} alvo={m.alvo} />
              ))}
            </div>
          )}
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

// ===================== Visão do Admin =====================
async function AdminMain() {
  await ensureMetaTable();
  const now = new Date();

  const [basesCount, contacts, incorreto, atualizado, ldrs, bases, metas, progress] = await Promise.all([
    prisma.base.count(),
    prisma.contact.count({ where: { deletedAt: null } }),
    prisma.contact.count({ where: { status: "telefone_incorreto", deletedAt: null } }),
    prisma.contact.count({ where: { status: "telefone_atualizado", deletedAt: null } }),
    prisma.user.findMany({ where: { role: "ldr" }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.base.findMany({ select: { id: true, name: true } }),
    prisma.meta.findMany() as Promise<Meta[]>,
    loadProgress(),
  ]);

  const baseName = (id: string | null) => bases.find((b) => b.id === id)?.name || "Base";
  const metasByUser = new Map<string, Meta[]>();
  for (const m of metas) {
    if (!metasByUser.has(m.userId)) metasByUser.set(m.userId, []);
    metasByUser.get(m.userId)!.push(m);
  }

  return (
    <main className="space-y-8 p-8">
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Bases" value={basesCount} color="text-indigo-600" hint="lotes importados/criados" />
        <StatCard label="Contatos" value={contacts} color="text-slate-800" hint="no total" />
        <StatCard label="Telefone Incorreto" value={incorreto} color="text-amber-600" hint="na fila de correção" />
        <StatCard label="Telefone Atualizado" value={atualizado} color="text-emerald-600" hint="já corrigidos" />
      </section>

      <section>
        <h2 className="mb-4 font-semibold text-slate-800">Metas por LDR</h2>
        {ldrs.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            Nenhum LDR cadastrado ainda. Crie usuários em Usuários e defina as metas de cada um.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {ldrs.map((u) => {
              const mine = metasByUser.get(u.id) || [];
              const fill = mine.filter((m) => m.tipo !== "correcao");
              const corr = mine.filter((m) => m.tipo === "correcao");
              return (
                <div key={u.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="truncate font-semibold text-slate-800">{u.name || u.email}</h3>
                    <span className="shrink-0 text-xs text-slate-400">{mine.length} meta(s)</span>
                  </div>
                  {mine.length === 0 ? (
                    <p className="text-sm text-slate-400">Sem metas definidas. Abra Usuários → Meta para configurar.</p>
                  ) : (
                    <div className="space-y-5">
                      {fill.length > 0 && (
                        <div className="space-y-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Preenchimento</p>
                          {fill.map((m) => (
                            <MetaBar key={m.id} label={fillLabel(m, baseName)} sub={`completas ${prazoLabel(m.prazo)}`} feito={metaFeito(m, now, progress.fills, progress.corrections)} alvo={m.alvo} />
                          ))}
                        </div>
                      )}
                      {corr.length > 0 && (
                        <div className="space-y-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Correção</p>
                          {corr.map((m) => (
                            <MetaBar key={m.id} label={m.campanha || "Campanha"} sub={`corrigidos ${prazoLabel(m.prazo)}`} feito={metaFeito(m, now, progress.fills, progress.corrections)} alvo={m.alvo} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
