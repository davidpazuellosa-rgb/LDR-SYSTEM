import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { ROLE_LABELS, ROLES } from "@/lib/permissions";
import { makeInvite, buildInviteLink } from "@/lib/invite";
import { sendInviteEmail } from "@/lib/email";
import { setProprietarioDoUsuario } from "@/lib/user-proprietario";

// Edita um usuário (admin): nome, cargo, ou gera um novo link de convite/redefinição.
// O admin NUNCA define a senha — só envia o link para a pessoa definir a própria.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, deny } = await requireAdmin();
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const selfId = (session.user as { id?: string }).id;

  // Ação: (re)gerar link para a pessoa definir a senha. Coloca a conta em "pendente"
  // até ela definir uma nova senha pelo link.
  if (body?.action === "reinvite") {
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, role: true } });
    if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    const { token, sentinel } = makeInvite(id);
    await prisma.user.update({ where: { id }, data: { passwordHash: sentinel } });
    const inviteLink = buildInviteLink(req, token);
    const mail = await sendInviteEmail({ to: target.email, name: target.name, link: inviteLink, role: ROLE_LABELS[target.role] || target.role });
    return NextResponse.json({ ok: true, inviteLink, emailSent: mail.sent, emailReason: mail.reason });
  }

  const data: Record<string, string> = {};
  if (typeof body?.name === "string") data.name = body.name.trim();
  if (body?.role && ROLES.includes(body.role)) {
    if (id === selfId && body.role !== "admin") {
      return NextResponse.json({ error: "Você não pode alterar o seu próprio cargo." }, { status: 400 });
    }
    data.role = body.role;
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  // Vínculo com o "Proprietário" do HubSpot (Pré-vendedor). Se sair do cargo
  // prevendedor, o vínculo é removido.
  if (typeof body?.proprietario === "string") {
    await setProprietarioDoUsuario(id, body.proprietario);
  } else if (body?.role && body.role !== "prevendedor") {
    await setProprietarioDoUsuario(id, null);
  }

  return NextResponse.json(user);
}

// Remove um usuário (admin). Não permite remover a si mesmo nem o último admin.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, deny } = await requireAdmin();
  if (deny) return deny;

  const { id } = await params;
  const selfId = (session.user as { id?: string }).id;
  if (id === selfId) {
    return NextResponse.json({ error: "Você não pode remover a si mesmo." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  if (target.role === "admin") {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) {
      return NextResponse.json({ error: "Não é possível remover o último administrador." }, { status: 400 });
    }
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
