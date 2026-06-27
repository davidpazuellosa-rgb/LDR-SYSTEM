import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { looksLikeValidPhone } from "@/lib/import";
import { pushCorrectionToHubspot, pushNaoEncontradoToHubspot } from "@/lib/hubspot-write";
import { PHONE_FIELD } from "@/lib/contact-fields";

// Resolve uma correção: grava o novo telefone na base local usada pela planilha,
// fecha o item da fila (preservando o histórico) e, quando válido, ENVIA ao HubSpot
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
  // LDR procurou e não achou número: fecha o item sem exigir telefone.
  const naoEncontrado = body?.naoEncontrado === true;
  const hasWhatsapp = body?.hasWhatsapp === true;
  // Contato institucional (Sim/Não). undefined = front não enviou (não mexe na propriedade).
  const institucional =
    body?.institucional === true ? true : body?.institucional === false ? false : undefined;
  const pessoaNome = String(body?.pessoaNome || "").trim();
  const pessoaCargo = String(body?.pessoaCargo || "").trim();
  if (!naoEncontrado && !newValue)
    return NextResponse.json({ error: "Novo telefone obrigatório" }, { status: 400 });

  const correction = await prisma.correction.findUnique({ where: { id } });
  if (!correction) return NextResponse.json({ error: "Correção não encontrada" }, { status: 404 });

  // Caminho "número não encontrado": fecha o item com status próprio ("nao_encontrado")
  // — assim ele SAI da fila (que mostra "pending") e NÃO conta na meta (que conta
  // "resolved"). Marca o contato e, no HubSpot, muda só a etapa do ciclo de vida
  // (desligado enquanto a etapa não estiver configurada).
  if (naoEncontrado) {
    await prisma.$transaction([
      prisma.correction.update({
        where: { id },
        data: {
          status: "nao_encontrado",
          resolvedAt: new Date(),
          // @ts-expect-error id custom na sessão
          resolvedById: session.user.id ?? null,
        },
      }),
      prisma.contact.update({
        where: { id: correction.contactId },
        data: { status: "telefone_nao_encontrado" },
      }),
    ]);

    let hubspot: { ok: boolean; error?: string } = { ok: false, error: "não enviado" };
    const alvo = await prisma.contact.findUnique({
      where: { id: correction.contactId },
      select: { hubspotId: true },
    });
    if (alvo?.hubspotId) hubspot = await pushNaoEncontradoToHubspot(alvo.hubspotId);

    return NextResponse.json({ ok: true, naoEncontrado: true, hubspot });
  }

  const valid = looksLikeValidPhone(newValue);

  const [, updatedContact] = await prisma.$transaction([
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
        [PHONE_FIELD]: newValue,
        ...(hasWhatsapp ? { whatsapp: newValue } : {}),
        status: valid ? "telefone_atualizado" : "telefone_incorreto",
      },
      select: {
        id: true,
        telefonePrefeitura: true,
        whatsapp: true,
        status: true,
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
      hubspot = await pushCorrectionToHubspot(contact.hubspotId, newValue, {
        hasWhatsapp,
        institucional,
        pessoaNome,
        pessoaCargo,
      });
    } else {
      hubspot = { ok: false, error: "contato ainda sem hubspotId (aguardando sincronização)" };
    }
  }

  return NextResponse.json({
    ok: true,
    valid,
    database: {
      ok: true,
      contactId: updatedContact.id,
      field: PHONE_FIELD,
      value: updatedContact.telefonePrefeitura,
      whatsapp: updatedContact.whatsapp,
      status: updatedContact.status,
    },
    hubspot,
  });
}
