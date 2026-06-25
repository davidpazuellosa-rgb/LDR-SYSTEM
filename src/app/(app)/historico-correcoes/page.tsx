import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { ufSigla } from "@/lib/uf";

export const dynamic = "force-dynamic";

function personInitials(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

export default async function HistoricoCorrecoesPage() {
  const historyRaw = await prisma.correction.findMany({
    where: {
      status: "resolved",
      newValue: { not: null },
      NOT: { newValue: "" },
      resolvedAt: { not: null },
    },
    orderBy: { resolvedAt: "desc" },
    take: 100,
    include: {
      contact: { select: { cidade: true, estado: true } },
      resolvedBy: { select: { name: true, email: true } },
    },
  });
  const history = historyRaw.filter((item) => item.newValue?.trim() && item.resolvedAt);

  return (
    <>
      <PageHeader title="Histórico de Correções" />
      <div className="space-y-4 p-8">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Histórico de correções</h2>
          {history.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {history.length}
            </span>
          )}
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
            Nenhuma correção concluída ainda.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Contato</th>
                    <th className="px-4 py-3">Antes</th>
                    <th className="px-4 py-3">Depois</th>
                    <th className="px-4 py-3">Quem corrigiu</th>
                    <th className="px-5 py-3 text-right">Quando</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <tr key={h.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-xs font-semibold text-indigo-600">
                            {ufSigla(h.contact.estado) || (h.contact.cidade || "?").trim().charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-800">{h.contact.cidade || "(sem cidade)"}</div>
                            {h.contact.estado && <div className="truncate text-xs text-slate-400">{h.contact.estado}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm tabular-nums text-slate-400 line-through decoration-slate-300">{h.oldValue || "-"}</td>
                      <td className="whitespace-nowrap px-4 py-4">
                        {h.newValue ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-sm font-medium tabular-nums text-emerald-700 ring-1 ring-emerald-100">
                            {h.newValue}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {h.resolvedBy ? (
                          <div className="flex items-center gap-2">
                            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">
                              {personInitials(h.resolvedBy.name, h.resolvedBy.email)}
                            </div>
                            <span className="truncate text-slate-600">{h.resolvedBy.name || h.resolvedBy.email}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2" title="Resolvida automaticamente pela sincronização com o HubSpot">
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400">
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M3 21v-5h5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                            <span className="truncate text-slate-400">Sincronização HubSpot</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right text-xs tabular-nums text-slate-400">
                        {h.resolvedAt
                          ? new Date(h.resolvedAt).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
