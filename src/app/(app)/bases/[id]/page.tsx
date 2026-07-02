import type { ComponentProps } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { currentRole } from "@/lib/current-role";
import { can, isAdmin } from "@/lib/permissions";
import { isComplete, customsCompletos, tipoOrgao } from "@/lib/completude";
import PageHeader from "@/components/PageHeader";
import ContactsTable from "@/components/ContactsTable";
import { ensureContactCustomTable, parseCustomCols } from "@/lib/custom-columns";

export const dynamic = "force-dynamic";

export default async function BaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ regiao?: string }>;
}) {
  const { id } = await params;
  const { regiao } = await searchParams;
  const session = await auth();
  const role = await currentRole(session);
  if (role === "prevendedor") redirect("/dashboard"); // Pré-vendedor não acessa Bases
  const base = await prisma.base.findUnique({
    where: { id },
    include: { contacts: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
  });

  if (!base) notFound();

  // Quando vem de um card de região, mostra só as prefeituras daquela região.
  const norm = (r: string | null) => (r && r.trim()) || "Sem região";
  const rows = regiao ? base.contacts.filter((c) => norm(c.regiao) === regiao) : base.contacts;

  const contacts = rows.map(({ createdAt, updatedAt, formats, deletedAt, ...contact }) => {
    void formats;
    void deletedAt;
    return {
      ...contact,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };
  });

  const initialFormats = Object.fromEntries(
    rows.map((c) => [c.id, (c.formats as Record<string, unknown>) || {}])
  ) as ComponentProps<typeof ContactsTable>["initialFormats"];
  // headers guarda rótulos de coluna E, na chave reservada __merges__, as mesclas
  // visuais (estilo Excel) compartilhadas pelo time. Separa as duas coisas aqui.
  const rawHeaders = ((base.headers as Record<string, unknown> | null) || {}) as Record<string, unknown>;
  const { __merges__: rawMerges, __cols__: _rawCols, ...labelHeaders } = rawHeaders;
  void _rawCols;
  const initialHeaders = labelHeaders as ComponentProps<typeof ContactsTable>["initialHeaders"];
  const initialMerges = (Array.isArray(rawMerges) ? rawMerges : []) as ComponentProps<
    typeof ContactsTable
  >["initialMerges"];

  // Colunas personalizadas (bloco à direita): definições em headers.__cols__ e valores
  // por contato na tabela ContactCustomValue (ambos sem migration).
  const initialCols = parseCustomCols(rawHeaders) as ComponentProps<typeof ContactsTable>["initialCols"];
  await ensureContactCustomTable();
  const customRows = rows.length
    ? await prisma.contactCustomValue.findMany({
        where: { contactId: { in: rows.map((c) => c.id) } },
        select: { contactId: true, colKey: true, valor: true },
      })
    : [];
  const initialCustomValues: Record<string, Record<string, string>> = {};
  for (const cv of customRows) {
    (initialCustomValues[cv.contactId] ||= {})[cv.colKey] = cv.valor ?? "";
  }

  // Conclusão do cabeçalho: 7 campos fixos + TODAS as colunas personalizadas preenchidas.
  const customKeys = (initialCols ?? []).map((c) => c.key);
  const concluidos = rows.filter((c) => isComplete(c) && customsCompletos(customKeys, initialCustomValues[c.id])).length;
  const aPreencher = rows.length - concluidos;

  // Última vez que a base foi salva (maior updatedAt entre os contatos) — para o
  // indicador "Salvo às …" continuar aparecendo quando o usuário reabre a tela.
  const lastSaved = rows.reduce<Date | null>(
    (max, c) => (!max || c.updatedAt > max ? c.updatedAt : max),
    null
  );

  // Volta para a lista de regiões do tipo quando veio de um card de região.
  const backHref = regiao ? `/bases?tipo=${encodeURIComponent(tipoOrgao(base.name))}` : "/bases";

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={regiao ? `${base.name} · ${regiao}` : base.name}
        action={
          <div className="flex items-center">
            <Link
              href={backHref}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
            >
              <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5m0 0 6-6m-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Voltar
            </Link>
            <div className="ml-6 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {concluidos.toLocaleString("pt-BR")} concluídos
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {aPreencher.toLocaleString("pt-BR")} a preencher
              </span>
            </div>
          </div>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col px-8 pb-3 pt-2">
        <ContactsTable
          baseId={base.id}
          initialContacts={contacts}
          initialFormats={initialFormats}
          initialHeaders={initialHeaders}
          initialMerges={initialMerges}
          initialCols={initialCols}
          initialCustomValues={initialCustomValues}
          me={{
            id: (session?.user as { id?: string } | undefined)?.id || "",
            nome: session?.user?.name || session?.user?.email || "Usuário",
          }}
          initialSavedAt={lastSaved?.toISOString() ?? null}
          canDelete={can(role, "contacts.delete")}
          canImport={can(role, "data.import")}
          canExport={can(role, "data.export")}
          canEditHeaders={isAdmin(role)}
        />
      </div>
    </div>
  );
}
