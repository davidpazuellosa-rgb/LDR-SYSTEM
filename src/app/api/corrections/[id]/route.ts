import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { looksLikeValidPhone } from "@/lib/import";
import { pushCorrectionToHubspot } from "@/lib/hubspot-write";

// Resolve uma correção: grava o novo telefone no contato, fecha o item da fila
// (preservando o histórico) e, quando válido, ENVIA a atualização ao HubSpot
// (telefone + Fase do Ciclo de Vida -> "Telefone Atualizado").
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, deny } = await requirePermission("corrections.write");
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const newValue = String(body?.newValue || "").trim();
  const hasWhatsapp = body?.hasWhatsapp === true;
  if (!newValue) return NextResponse.json({ error: "Novo telefone obrigatório" }, { status: 400 });

  const correction = await prisma.correction.findUnique({ where: { id } });
  if (!correction) return NextResponse.json({ error: "Correção não encontrada" }, { status: 404 });

  const valid = looksLikeValidPhone(newValue);

  await prisma.$transaction([
    prisma.correction.update({
      where: { id },
      data: {
        newValue,
        status: "resolved",
        resolvedAt: new Date(),
        // @ts-expect-error id custom na sessão
        resolvedById: session.user.id ?? null,
      },
    }),
    prisma.contact.update({
      where: { id: correction.contactId },
      data: {
        telefonePrefeitura: newValue,
        ...(hasWhatsapp ? { whatsapp: newValue } : {}),
        status: valid ? "telefone_atualizado" : "telefone_incorreto",
      },
    }),
  ]);

  // Envia ao HubSpot (best-effort): atualiza o telefone e muda a fase para "Telefone Atualizado".
  // Se falhar, a correção local continua salva (não bloqueia o LDR).
  let hubspot: { ok: boolean; error?: string } = { ok: false, error: "não enviado" };
  if (valid) {
    const contact = await prisma.contact.findUnique({
      where: { id: correction.contactId },
      select: { hubspotId: true },
    });
    if (contact?.hubspotId) {
      hubspot = await pushCorrectionToHubspot(contact.hubspotId, newValue, { hasWhatsapp });
    } else {
      hubspot = { ok: false, error: "contato ainda sem hubspotId (aguardando sincronização)" };
    }
  }

  return NextResponse.json({ ok: true, valid, hubspot });
}
