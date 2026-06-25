import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import NewBaseButton from "@/components/NewBaseButton";
import { isComplete, pctOf, tier, tipoOrgao, type ReqRow } from "@/lib/completude";

export const dynamic = "force-dynamic";

// Página de Bases em 3 níveis:
//   1. /bases               → cards por TIPO de órgão (Prefeitura, Secretaria de Educação…)
//   2. /bases?tipo=<tipo>    → cards por REGIÃO/planilha (cada base = uma planilha)
//   3. /bases/[id]           → abre a planilha daquela região
// A régua de conclusão + cores ficam em @/lib/completude (compartilhado).

type ContactRow = ReqRow & { baseId: string; regiao: string | null };
type RegiaoAgg = { regiao: string; total: number; done: number };
type BaseAgg = { total: number; done: number; regioes: Map<string, RegiaoAgg> };

// Ícone por tipo de órgão (nível 1). Cai no genérico de banco para tipos novos.
function TipoIcon({ tipo }: { tipo: string }) {
  if (tipo === "Secretaria de Educação")
    return (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M22 10 12 5 2 10l10 5 10-5Z" strokeLinejoin="round" />
        <path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (tipo === "Prefeitura")
    return (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 21h18M4 21V10l8-5 8 5v11" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 21v-6h6v6M9 11h.01M15 11h.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  );
}

// Ordem preferida dos tipos no nível 1; tipos novos vão para o fim, em ordem alfabética.
const TIPO_ORDER = ["Prefeitura", "Secretaria de Educação", "Secretaria de Saúde", "SENAI"];
const tipoRank = (t: string) => {
  const i = TIPO_ORDER.indexOf(t);
  return i === -1 ? TIPO_ORDER.length : i;
};

export default async function BasesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo } = await searchParams;

  const bases = await prisma.base.findMany({ orderBy: { createdAt: "desc" } });

  const contacts = (await prisma.contact.findMany({
    where: { deletedAt: null },
    select: {
      baseId: true,
      regiao: true,
      cidade: true,
      estado: true,
      telefonePrefeitura: true,
      emailInstitucional: true,
      nomePrefeito: true,
      whatsapp: true,
      siteOficial: true,
    },
  })) as ContactRow[];

  const agg = new Map<string, BaseAgg>(bases.map((b) => [b.id, { total: 0, done: 0, regioes: new Map() }]));
  for (const c of contacts) {
    const b = agg.get(c.baseId);
    if (!b) continue;
    const ok = isComplete(c);
    b.total += 1;
    if (ok) b.done += 1;
    const reg = (c.regiao && c.regiao.trim()) || "Sem região";
    const s = b.regioes.get(reg) ?? { regiao: reg, total: 0, done: 0 };
    s.total += 1;
    if (ok) s.done += 1;
    b.regioes.set(reg, s);
  }

  // ─── Nível 1: cards por tipo de órgão ────────────────────────────────────
  if (!tipo) {
    type TipoAgg = { tipo: string; total: number; done: number; planilhas: number };
    const tipos = new Map<string, TipoAgg>();
    for (const b of bases) {
      const t = tipoOrgao(b.name);
      const a = agg.get(b.id)!;
      const e = tipos.get(t) ?? { tipo: t, total: 0, done: 0, planilhas: 0 };
      e.total += a.total;
      e.done += a.done;
      e.planilhas += 1;
      tipos.set(t, e);
    }
    const lista = [...tipos.values()].sort(
      (x, y) => tipoRank(x.tipo) - tipoRank(y.tipo) || x.tipo.localeCompare(y.tipo)
    );

    return (
      <>
        <PageHeader title="Bases de Dados" />
        <div className="space-y-5 p-8">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {lista.length} {lista.length === 1 ? "tipo de órgão" : "tipos de órgão"} · {bases.length}{" "}
              {bases.length === 1 ? "planilha" : "planilhas"}
            </p>
            <NewBaseButton />
          </div>

          {bases.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
              Nenhuma base ainda. Clique em <strong>+ Nova base</strong> para começar.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {lista.map((e) => {
                const pct = pctOf(e.done, e.total);
                const t = tier(pct);
                return (
                  <Link
                    key={e.tipo}
                    href={`/bases?tipo=${encodeURIComponent(e.tipo)}`}
                    className={`group flex flex-col rounded-2xl border border-l-4 border-slate-200 ${t.borderL} bg-white p-5 shadow-sm transition hover:shadow-md`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                        <TipoIcon tipo={e.tipo} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-800">{e.tipo}</h3>
                        <p className="text-xs text-slate-400">
                          {e.planilhas} {e.planilhas === 1 ? "planilha" : "planilhas"}
                        </p>
                      </div>
                    </div>

                    {e.total > 0 && (
                      <div className="mt-4">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={`text-2xl font-bold ${t.text}`}>{pct}%</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${t.chip}`}>{t.label}</span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(2, pct)}%` }} />
                        </div>
                        <p className="mt-1.5 text-xs text-slate-400">
                          {e.done.toLocaleString("pt-BR")} de {e.total.toLocaleString("pt-BR")} preenchidos
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-sm text-slate-500">
                        <strong className="font-semibold text-slate-800">{e.total.toLocaleString("pt-BR")}</strong>{" "}
                        {e.total === 1 ? "contato" : "contatos"}
                      </span>
                      <span className="flex items-center gap-1 text-sm font-medium text-indigo-600 transition-all group-hover:gap-2">
                        Ver regiões
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  }

  // ─── Nível 2: cards por região ───────────────────────────────────────────
  // Cada região vira um card próprio (uma "planilha"), mesmo quando várias
  // regiões moram dentro da mesma base — é o caso do Aluno a Bordo.
  const doTipo = bases.filter((b) => tipoOrgao(b.name) === tipo);
  const multiBase = doTipo.length > 1;

  type RegCard = { baseId: string; baseName: string; isImport: boolean; regiao: string; total: number; done: number };
  const cards: RegCard[] = [];
  for (const b of doTipo) {
    const a = agg.get(b.id)!;
    for (const s of a.regioes.values()) {
      cards.push({ baseId: b.id, baseName: b.name, isImport: b.source === "import", regiao: s.regiao, total: s.total, done: s.done });
    }
  }
  cards.sort((x, y) => x.regiao.localeCompare(y.regiao) || x.baseName.localeCompare(y.baseName));

  return (
    <>
      <PageHeader
        title={tipo}
        action={
          <Link href="/bases" className="text-sm text-indigo-600 hover:underline">
            ← tipos de órgão
          </Link>
        }
      />
      <div className="space-y-5 p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {cards.length} {cards.length === 1 ? "região" : "regiões"}
          </p>
          <NewBaseButton />
        </div>

        {cards.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            Nenhuma região com dados neste tipo ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => {
              const pct = pctOf(c.done, c.total);
              const t = tier(pct);
              return (
                <Link
                  key={`${c.baseId}:${c.regiao}`}
                  href={`/bases/${c.baseId}?regiao=${encodeURIComponent(c.regiao)}`}
                  className={`group flex flex-col rounded-2xl border border-l-4 border-slate-200 ${t.borderL} bg-white p-5 shadow-sm transition hover:shadow-md`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                        <DatabaseIcon />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-800">{c.regiao}</h3>
                        {multiBase && <p className="truncate text-xs text-slate-400">{c.baseName}</p>}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${c.isImport ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"}`}>
                      {c.isImport ? "importada" : "manual"}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`text-2xl font-bold ${t.text}`}>{pct}%</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${t.chip}`}>{t.label}</span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(2, pct)}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">
                      {c.done.toLocaleString("pt-BR")} de {c.total.toLocaleString("pt-BR")} prefeituras preenchidas
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-sm text-slate-500">
                      <strong className="font-semibold text-slate-800">{c.total.toLocaleString("pt-BR")}</strong>{" "}
                      {c.total === 1 ? "contato" : "contatos"}
                    </span>
                    <span className="flex items-center gap-1 text-sm font-medium text-indigo-600 transition-all group-hover:gap-2">
                      Abrir planilha
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
