import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import NewBaseButton from "@/components/NewBaseButton";

export const dynamic = "force-dynamic";

// "Preenchida/completa" = TODAS estas colunas com valor. Ajuste a lista aqui se a
// régua mudar (adicionar/remover colunas é só editar este array).
const REQUIRED_FIELDS = [
  "cidade",
  "estado",
  "telefonePrefeitura",
  "emailInstitucional",
  "nomePrefeito",
  "whatsapp",
  "siteOficial",
] as const;

type ReqRow = Record<(typeof REQUIRED_FIELDS)[number], string | null> & { baseId: string };

const nonEmpty = (v: string | null) => !!(v && v.trim());
const isComplete = (c: ReqRow) => REQUIRED_FIELDS.every((f) => nonEmpty(c[f]));
const pctOf = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

// Cores por conclusão: 0 vermelho · 1-49 amarelo · 50-99 laranja · 100 verde.
function tier(pct: number) {
  if (pct >= 100) return { label: "Concluído", borderL: "border-l-emerald-500", bar: "bg-emerald-500", text: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  if (pct >= 50) return { label: "Quase lá", borderL: "border-l-orange-500", bar: "bg-orange-500", text: "text-orange-600", chip: "bg-orange-50 text-orange-700 ring-orange-200" };
  if (pct > 0) return { label: "Em andamento", borderL: "border-l-amber-400", bar: "bg-amber-400", text: "text-amber-600", chip: "bg-amber-50 text-amber-700 ring-amber-200" };
  return { label: "Não iniciado", borderL: "border-l-red-500", bar: "bg-red-500", text: "text-red-600", chip: "bg-red-50 text-red-700 ring-red-200" };
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

type RegiaoAgg = { regiao: string; total: number; done: number };
type BaseAgg = { total: number; done: number; regioes: Map<string, RegiaoAgg> };

export default async function BasesPage() {
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
  })) as (ReqRow & { regiao: string | null })[];

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

  return (
    <>
      <PageHeader title="Bases de Dados" />
      <div className="space-y-5 p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {bases.length} {bases.length === 1 ? "base" : "bases"} no total
          </p>
          <NewBaseButton />
        </div>

        {bases.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            Nenhuma base ainda. Clique em <strong>+ Nova base</strong> para começar.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {bases.map((b) => {
              const isImport = b.source === "import";
              const a = agg.get(b.id) ?? { total: 0, done: 0, regioes: new Map() };
              const pct = pctOf(a.done, a.total);
              const t = tier(pct);
              const regioes = [...a.regioes.values()].sort((x, y) => x.regiao.localeCompare(y.regiao));

              return (
                <Link
                  key={b.id}
                  href={`/bases/${b.id}`}
                  className={`group flex flex-col rounded-2xl border border-l-4 border-slate-200 ${t.borderL} bg-white p-5 shadow-sm transition hover:shadow-md`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                        <DatabaseIcon />
                      </span>
                      <h3 className="truncate font-semibold text-slate-800">{b.name}</h3>
                    </div>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${isImport ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"}`}>
                      {isImport ? "importada" : "manual"}
                    </span>
                  </div>

                  {b.description && <p className="mt-3 line-clamp-2 text-sm text-slate-500">{b.description}</p>}

                  {/* Conclusão da base (prefeituras preenchidas) */}
                  {a.total > 0 && (
                    <div className="mt-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-2xl font-bold ${t.text}`}>{pct}%</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${t.chip}`}>{t.label}</span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(2, pct)}%` }} />
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400">
                        {a.done.toLocaleString("pt-BR")} de {a.total.toLocaleString("pt-BR")} prefeituras preenchidas
                      </p>

                      {regioes.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {regioes.map((s) => {
                            const sp = pctOf(s.done, s.total);
                            return (
                              <span
                                key={s.regiao}
                                title={`${s.regiao}: ${s.done}/${s.total} (${sp}%)`}
                                className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${tier(sp).chip}`}
                              >
                                {s.regiao} · {sp}%
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-sm text-slate-500">
                      <strong className="font-semibold text-slate-800">{a.total.toLocaleString("pt-BR")}</strong>{" "}
                      {a.total === 1 ? "contato" : "contatos"}
                    </span>
                    <span className="flex items-center gap-1 text-sm font-medium text-indigo-600 transition-all group-hover:gap-2">
                      Abrir
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
