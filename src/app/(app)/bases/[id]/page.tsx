import type { ComponentProps } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { can, isAdmin } from "@/lib/permissions";
import { tipoOrgao } from "@/lib/completude";
import PageHeader from "@/components/PageHeader";
import ContactsTable from "@/components/ContactsTable";

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
  const role = (session?.user as { role?: string } | undefined)?.role;
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
  const initialHeaders = ((base.headers as Record<string, string> | null) || {}) as ComponentProps<
    typeof ContactsTable
  >["initialHeaders"];

  // Última vez que a base foi salva (maior updatedAt entre os contatos) — para o
  // indicador "Salvo às …" continuar aparecendo quando o usuário reabre a tela.
  const lastSaved = rows.reduce<Date | null>(
    (max, c) => (!max || c.updatedAt > max ? c.updatedAt : max),
    null
  );

  // Volta para a lista de regiões do tipo quando veio de um card de região.
  const backHref = regiao ? `/bases?tipo=${encodeURIComponent(tipoOrgao(base.name))}` : "/bases";

  return (
    <>
      <PageHeader
        title={regiao ? `${base.name} · ${regiao}` : base.name}
        action={
          <Link
            href={backHref}
            className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
          >
            <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5m0 0 6-6m-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Voltar
          </Link>
        }
      />
      <div className="flex h-full flex-col p-8">
        <ContactsTable
          baseId={base.id}
          initialContacts={contacts}
          initialFormats={initialFormats}
          initialHeaders={initialHeaders}
          initialSavedAt={lastSaved?.toISOString() ?? null}
          canDelete={can(role, "contacts.delete")}
          canImport={can(role, "data.import")}
          canExport={can(role, "data.export")}
          canEditHeaders={isAdmin(role)}
        />
      </div>
    </>
  );
}
