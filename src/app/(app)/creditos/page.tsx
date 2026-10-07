import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin, OPERATOR_ROLES } from "@/lib/permissions";
import { ensureContactFillTable } from "@/lib/contact-fill";
import { ensureAuditoriaTables, creditosSuspeitos } from "@/lib/auditoria";
import PageHeader from "@/components/PageHeader";
import CreditosView, { type LinhaCredito, type Ajuste } from "@/components/CreditosView";

export const dynamic = "force-dynamic";

const PERIODOS: Record<string, { label: string; horas: number }> = {
  hoje: { label: "Hoje", horas: 0 },
  "48h": { label: "Últimas 48 h", horas: 48 },
  "7d": { label: "7 dias", horas: 24 * 7 },
  "30d": { label: "30 dias", horas: 24 * 30 },
};
const LIMITE = 500;

// Revisão de créditos de preenchimento (só admin): quem recebeu crédito por qual linha, as
// últimas alterações daquela linha, e a opção de remover/reatribuir com motivo registrado.
export default async function CreditosPage({ searchParams }: { searchParams: Promise<{ pessoa?: string; periodo?: string; base?: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdmin(role)) redirect("/dashboard");
  const sp = await searchParams;
  const periodo = sp.periodo && PERIODOS[sp.periodo] ? sp.periodo : "hoje";

  await Promise.all([ensureContactFillTable(), ensureAuditoriaTables()]);
  const desde = periodo === "hoje"
    ? new Date(new Date(Date.now() - 3 * 3600000).setUTCHours(0, 0, 0, 0) + 3 * 3600000) // 00:00 de Brasília
    : new Date(Date.now() - PERIODOS[periodo].horas * 3600000);

  const [fills, pessoas, bases, suspeitos, ajustesRaw] = await Promise.all([
    prisma.contactFill.findMany({
      where: { concluidoEm: { gte: desde }, ...(sp.pessoa ? { preenchidoPorId: sp.pessoa } : {}) },
      orderBy: { concluidoEm: "desc" },
      take: LIMITE + 1,
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true }, orderBy: { name: "asc" } }),
    prisma.base.findMany({ select: { id: true, name: true } }),
    creditosSuspeitos(),
    prisma.$queryRaw<{ id: string; contactId: string; acao: string; dePessoaId: string | null; paraPessoaId: string | null; motivo: string | null; porId: string | null; em: Date }[]>`
      SELECT "id","contactId","acao","dePessoaId","paraPessoaId","motivo","porId","em" FROM "CreditoLog" WHERE "acao" <> 'dado' ORDER BY "em" DESC LIMIT 30`,
  ]);
  const truncado = fills.length > LIMITE;
  const lista = fills.slice(0, LIMITE);

  const contatos = await prisma.contact.findMany({
    where: { id: { in: lista.map((f) => f.contactId) } },
    select: { id: true, baseId: true, cidade: true, estado: true },
  });
  const porContato = new Map(contatos.map((c) => [c.id, c]));
  const nomeBase = new Map(bases.map((b) => [b.id, b.name]));
  const nomeDe = new Map(pessoas.map((p) => [p.id, p.name || p.email]));

  // Últimas alterações de cada linha listada (quem, o quê, antes → depois).
  const logs = lista.length
    ? await prisma.$queryRaw<{ contactId: string; campo: string; de: string | null; para: string | null; porId: string | null; em: Date }[]>`
        SELECT * FROM (
          SELECT "contactId","campo","de","para","porId","em", row_number() OVER (PARTITION BY "contactId" ORDER BY "em" DESC) AS rn
          FROM "CelulaLog" WHERE "contactId" = ANY(${lista.map((f) => f.contactId)})
        ) t WHERE rn <= 3 ORDER BY "em" DESC`
    : [];
  const logsPor = new Map<string, { quem: string; campo: string; de: string; para: string; em: string }[]>();
  for (const l of logs) {
    const arr = logsPor.get(l.contactId) ?? [];
    arr.push({ quem: (l.porId && nomeDe.get(l.porId)) || "—", campo: l.campo, de: l.de ?? "", para: l.para ?? "", em: l.em.toISOString() });
    logsPor.set(l.contactId, arr);
  }

  let linhas: LinhaCredito[] = lista.map((f) => {
    const c = porContato.get(f.contactId);
    return {
      contactId: f.contactId, pessoaId: f.preenchidoPorId, pessoa: nomeDe.get(f.preenchidoPorId) || "—",
      baseId: c?.baseId ?? "", planilha: (c && nomeBase.get(c.baseId)) || "(linha excluída)",
      contato: c ? [c.cidade, c.estado].filter(Boolean).join(" · ") || "(sem cidade)" : "(linha excluída)",
      em: f.concluidoEm.toISOString(), alteracoes: logsPor.get(f.contactId) ?? [],
    };
  });
  if (sp.base) linhas = linhas.filter((l) => l.baseId === sp.base);

  const ajustes: Ajuste[] = ajustesRaw.map((a) => ({
    id: a.id, acao: a.acao, de: (a.dePessoaId && nomeDe.get(a.dePessoaId)) || "—", para: (a.paraPessoaId && nomeDe.get(a.paraPessoaId)) || "",
    motivo: a.motivo ?? "", por: (a.porId && nomeDe.get(a.porId)) || "—", em: a.em.toISOString(),
  }));

  return (
    <>
      <PageHeader title="Revisar créditos" />
      <main className="mx-auto max-w-[1400px] space-y-5 p-6">
        <CreditosView
          linhas={linhas}
          truncado={truncado}
          periodo={periodo}
          periodos={Object.entries(PERIODOS).map(([v, p]) => ({ value: v, label: p.label }))}
          pessoaSel={sp.pessoa || null}
          baseSel={sp.base || null}
          pessoas={pessoas.filter((p) => p.role === "admin" || (OPERATOR_ROLES as string[]).includes(p.role)).map((p) => ({ id: p.id, nome: p.name || p.email }))}
          bases={bases.map((b) => ({ id: b.id, nome: b.name })).sort((a, b) => a.nome.localeCompare(b.nome))}
          suspeitos={suspeitos}
          ajustes={ajustes}
        />
      </main>
    </>
  );
}
