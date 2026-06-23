import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import NewBaseButton from "@/components/NewBaseButton";

export const dynamic = "force-dynamic";

function DatabaseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  );
}

export default async function BasesPage() {
  const bases = await prisma.base.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { contacts: true } },
    },
  });

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
              return (
                <Link
                  key={b.id}
                  href={`/bases/${b.id}`}
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                        <DatabaseIcon />
                      </span>
                      <h3 className="truncate font-semibold text-slate-800">{b.name}</h3>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                        isImport ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isImport ? "importada" : "manual"}
                    </span>
                  </div>

                  {b.description && (
                    <p className="mt-3 line-clamp-2 text-sm text-slate-500">{b.description}</p>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-sm text-slate-500">
                      <strong className="font-semibold text-slate-800">
                        {b._count.contacts.toLocaleString("pt-BR")}
                      </strong>{" "}
                      {b._count.contacts === 1 ? "contato" : "contatos"}
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
