import type { ComponentProps } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { currentRole } from "@/lib/current-role";
import { can, isAdmin } from "@/lib/permissions";
import { tipoOrgao } from "@/lib/completude";
import PageHeader from "@/components/PageHeader";
import ContactsTable from "@/components/ContactsTable";
import { ensureContactCustomTable, parseCustomCols } from "@/lib/custom-columns";
import { parseColOrder, parseHeaderLabels, parseHiddenCols } from "@/lib/base-columns";
import { ensureContactOrdemColuna, parseSortBy } from "@/lib/contact-ordem";
import { parseAbas } from "@/lib/base-abas";
import { garantirLinhasIniciais } from "@/lib/linhas-iniciais";

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

  // "ordem" é escrita pela ordenação compartilhada (Classificar A→Z/Z→A no cabeçalho).
  // Linhas nunca ordenadas (ordem null) caem no fim, na ordem de criação.
  await ensureContactOrdemColuna();
  // Planilha vazia abre com linhas em branco em vez de "Nenhum contato" (uma vez só
  // por base — ver headers.__semeada__). Antes do findUnique pra já vir com elas.
  await garantirLinhasIniciais(id, {
    regiao: regiao ?? null,
    createdById: (session?.user as { id?: string } | undefined)?.id ?? null,
  });
  const base = await prisma.base.findUnique({
    where: { id },
    include: {
      contacts: {
        where: { deletedAt: null },
        orderBy: [{ ordem: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      },
    },
  });

  if (!base) notFound();

  // Quando vem de um card de região, mostra só as prefeituras daquela região.
  const norm = (r: string | null) => (r && r.trim()) || "Sem região";
  const rows = regiao ? base.contacts.filter((c) => norm(c.regiao) === regiao) : base.contacts;

  const contacts = rows.map(({ createdAt, updatedAt, formats, deletedAt, ordem, ...contact }) => {
    void formats;
    void deletedAt;
    void ordem;
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
  const rawMerges = rawHeaders.__merges__;
  // parseHeaderLabels descarta TODAS as chaves reservadas (__cols__, __order__,
  // __hidden__, __sortBy__…), deixando só os rótulos renomeados de coluna.
  const initialHeaders = parseHeaderLabels(rawHeaders) as ComponentProps<typeof ContactsTable>["initialHeaders"];
  const initialMerges = (Array.isArray(rawMerges) ? rawMerges : []) as ComponentProps<
    typeof ContactsTable
  >["initialMerges"];

  // Colunas personalizadas (bloco à direita): definições em headers.__cols__ e valores
  // por contato na tabela ContactCustomValue (ambos sem migration).
  const initialCols = parseCustomCols(rawHeaders) as ComponentProps<typeof ContactsTable>["initialCols"];
  const initialSort = parseSortBy(rawHeaders);
  // Ordem e ocultas são COMPARTILHADAS (headers.__order__/__hidden__) — antes
  // viviam no localStorage de cada navegador, o que fazia o CSV sair diferente
  // do que a pessoa via na tela.
  const initialOrder = parseColOrder(rawHeaders);
  const initialHidden = parseHiddenCols(rawHeaders);
  // Páginas (abas) guardadas: existem mesmo sem nenhuma linha na UF ainda.
  const initialAbas = parseAbas(rawHeaders);
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
      <div className="flex min-h-0 flex-1 flex-col px-8 pb-3 pt-2">
        <ContactsTable
          baseId={base.id}
          initialContacts={contacts}
          initialFormats={initialFormats}
          initialHeaders={initialHeaders}
          initialMerges={initialMerges}
          initialCols={initialCols}
          initialCustomValues={initialCustomValues}
          initialSort={initialSort}
          initialOrder={initialOrder}
          initialHidden={initialHidden}
          initialAbas={initialAbas}
          regiao={regiao ?? null}
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
