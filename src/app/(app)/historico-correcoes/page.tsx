import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

function cityInitials(city: string | null, state: string | null) {
  const first = (city || "?").trim().charAt(0).toUpperCase();
  return state ? `${first}${state}` : first;
}

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
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
                            {cityInitials(h.contact.cidade, h.contact.estado)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-800">{h.contact.cidade || "(sem cidade)"}</div>
                            {h.contact.estado && <div className="text-xs text-slate-400">{h.contact.estado}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 line-through decoration-slate-300">{h.oldValue || "-"}</td>
                      <td className="px-4 py-3">
                        {h.newValue ? (
                          <span className="font-medium text-emerald-700">{h.newValue}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {h.resolvedBy ? (
                          <div className="flex items-center gap-2">
                            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">
                              {personInitials(h.resolvedBy.name, h.resolvedBy.email)}
                            </div>
                            <span className="truncate text-slate-600">{h.resolvedBy.name || h.resolvedBy.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-slate-400">
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
