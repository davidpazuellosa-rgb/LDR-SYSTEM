import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { ensureContactFillTable } from "@/lib/contact-fill";
import { ensureAuditoriaTables, registrarCredito } from "@/lib/auditoria";

export const dynamic = "force-dynamic";

// Revisão de créditos (SÓ admin): remover o crédito de preenchimento de linhas, ou passá-lo
// para outra pessoa. O motivo é obrigatório e fica no CreditoLog junto com quem fez.
export async function POST(req: Request) {
  const { session, deny } = await requireAdmin();
  if (deny) return deny;
  const meId = session?.user?.id ?? null;

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.contactIds) ? [...new Set(body.contactIds.map((v: unknown) => String(v)).filter(Boolean))] as string[] : [];
  const acao = body?.acao === "reatribuir" ? "reatribuir" : body?.acao === "remover" ? "remover" : null;
  const motivo = String(body?.motivo || "").trim().slice(0, 300);
  const paraId = body?.paraId ? String(body.paraId) : null;
  if (!acao) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  if (ids.length === 0 || ids.length > 1000) return NextResponse.json({ error: "Escolha de 1 a 1000 linhas." }, { status: 400 });
  if (motivo.length < 3) return NextResponse.json({ error: "Informe o motivo (mín. 3 letras)." }, { status: 400 });
  if (acao === "reatribuir") {
    if (!paraId || !(await prisma.user.findUnique({ where: { id: paraId }, select: { id: true } }))) {
      return NextResponse.json({ error: "Escolha a pessoa que recebe o crédito." }, { status: 400 });
    }
  }

  await Promise.all([ensureContactFillTable(), ensureAuditoriaTables()]);
  const atuais = await prisma.contactFill.findMany({ where: { contactId: { in: ids } }, select: { contactId: true, preenchidoPorId: true } });
  if (atuais.length === 0) return NextResponse.json({ ok: true, alterados: 0 });

  if (acao === "remover") {
    await prisma.contactFill.deleteMany({ where: { contactId: { in: atuais.map((a) => a.contactId) } } });
  } else {
    await prisma.contactFill.updateMany({ where: { contactId: { in: atuais.map((a) => a.contactId) } }, data: { preenchidoPorId: paraId! } });
  }
  // Um registro por linha (a trilha precisa dizer exatamente o que mudou).
  await Promise.all(
    atuais.map((a) =>
      registrarCredito({
        contactId: a.contactId, acao: acao === "remover" ? "removido" : "reatribuido",
        dePessoaId: a.preenchidoPorId, paraPessoaId: acao === "reatribuir" ? paraId : null, motivo, porId: meId,
      })
    )
  );
  return NextResponse.json({ ok: true, alterados: atuais.length });
}
