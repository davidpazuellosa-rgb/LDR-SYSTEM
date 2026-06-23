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
    include: { contacts: { orderBy: { createdAt: "asc" } } },
  });

  if (!base) notFound();

  const contacts = base.contacts.map(({ createdAt, updatedAt, ...contact }) => ({
    ...contact,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  }));

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
      <div className="p-8">
        <ContactsTable
          baseId={base.id}
          initialContacts={contacts}
          canDelete={can(role, "contacts.delete")}
          canImport={can(role, "data.import")}
          canExport={can(role, "data.export")}
        />
      </div>
    </>
  );
}
