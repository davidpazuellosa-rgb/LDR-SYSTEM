import type { ComponentProps } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { can } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import ContactsTable from "@/components/ContactsTable";

export const dynamic = "force-dynamic";

export default async function BaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const base = await prisma.base.findUnique({
    where: { id },
    include: { contacts: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
  });

  if (!base) notFound();

  const contacts = base.contacts.map(({ createdAt, updatedAt, formats, deletedAt, ...contact }) => {
    void formats;
    void deletedAt;
    return {
      ...contact,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };
  });

  const initialFormats = Object.fromEntries(
    base.contacts.map((c) => [c.id, (c.formats as Record<string, unknown>) || {}])
  ) as ComponentProps<typeof ContactsTable>["initialFormats"];

  // Última vez que a base foi salva (maior updatedAt entre os contatos) — para o
  // indicador "Salvo às …" continuar aparecendo quando o usuário reabre a tela.
  const lastSaved = base.contacts.reduce<Date | null>(
    (max, c) => (!max || c.updatedAt > max ? c.updatedAt : max),
    null
  );

  return (
    <>
      <PageHeader
        title={base.name}
        action={
          <Link href="/bases" className="text-sm text-indigo-600 hover:underline">
            ← voltar
          </Link>
        }
      />
      <div className="flex h-full flex-col p-8">
        <ContactsTable
          baseId={base.id}
          initialContacts={contacts}
          initialFormats={initialFormats}
          initialSavedAt={lastSaved?.toISOString() ?? null}
          canDelete={can(role, "contacts.delete")}
          canImport={can(role, "data.import")}
          canExport={can(role, "data.export")}
        />
      </div>
    </>
  );
}
