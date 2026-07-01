import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { currentRole } from "@/lib/current-role";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import NovoOrgaoButton from "@/components/NovoOrgaoButton";
import RegioesGrid from "@/components/RegioesGrid";
import { isComplete, pctOf, tier, tipoOrgao, regiaoCanonica, REGIOES_BRASIL, type ReqRow } from "@/lib/completude";

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

  // Pré-vendedor não acessa Bases de Dados (cargo lido do banco — sem re-login).
  const session = await auth();
  if ((await currentRole(session)) === "prevendedor") redirect("/dashboard");

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
            <NovoOrgaoButton />
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

  // ─── Nível 2: as 5 regiões do Brasil para este órgão ─────────────────────
  // Mostra SEMPRE as 5 regiões (mesmo sem planilha). Os dados vêm dos contatos;
  // bases vazias entram pela região do nome ("{Órgão} - {Região}").
  const doTipo = bases.filter((b) => tipoOrgao(b.name) === tipo);
  const byReg = new Map<string, { total: number; done: number; baseId: string | null; isImport: boolean }>();
  for (const b of doTipo) {
    const a = agg.get(b.id)!;
    if (a.regioes.size > 0) {
      for (const s of a.regioes.values()) {
        const r = regiaoCanonica(s.regiao);
        if (!r) continue;
        const cur = byReg.get(r) ?? { total: 0, done: 0, baseId: b.id, isImport: false };
        cur.total += s.total;
        cur.done += s.done;
        cur.baseId = b.id;
        cur.isImport = cur.isImport || b.source === "import";
        byReg.set(r, cur);
      }
    } else {
      const r = regiaoCanonica(b.name.split(" - ")[1] || "");
      if (r && !byReg.has(r)) byReg.set(r, { total: 0, done: 0, baseId: b.id, isImport: b.source === "import" });
    }
  }
  const regioesCards = REGIOES_BRASIL.map((r) => {
    const e = byReg.get(r);
    return {
      regiao: r as string,
      total: e?.total ?? 0,
      done: e?.done ?? 0,
      baseId: e?.baseId ?? null,
      hasPlanilha: !!e && (e.total > 0 || e.isImport),
    };
  });

  return (
    <>
      <PageHeader
        title={tipo}
        action={
          <Link
            href="/bases"
            className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
          >
            <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5m0 0 6-6m-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Tipos de órgão
          </Link>
        }
      />
      <div className="space-y-5 p-8">
        <RegioesGrid orgao={tipo} cards={regioesCards} />
      </div>
    </>
  );
}
