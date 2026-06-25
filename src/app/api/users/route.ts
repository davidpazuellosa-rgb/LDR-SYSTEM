import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { ROLE_LABELS, ROLES } from "@/lib/permissions";
import { makeInvite, isInvitePending, buildInviteLink } from "@/lib/invite";
import { sendInviteEmail } from "@/lib/email";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Lista usuários (admin). Inclui o status "pending" (convite ainda não aceito),
// SEM nunca expor o passwordHash.
export async function GET() {
  const { deny } = await requireAdmin();
  if (deny) return deny;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true, passwordHash: true },
  });
  return NextResponse.json(
    users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt, pending: isInvitePending(u.passwordHash) }))
  );
}

// Convida um novo usuário (admin): define nome, e-mail e CARGO. NÃO define senha —
// a pessoa define a própria senha pelo link do convite. Retorna o inviteLink.
export async function POST(req: Request) {
  const { deny } = await requireAdmin();
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").toLowerCase().trim();
  const name = body?.name ? String(body.name).trim() : null;
  const role = ROLES.includes(body?.role) ? body.role : "ldr";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Já existe um usuário com esse e-mail." }, { status: 400 });

  // Cria em estado "pendente" e gera o convite (token guardado como sentinela).
  const created = await prisma.user.create({
    data: { email, name, role, passwordHash: "invite$pending" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  const { token, sentinel } = makeInvite(created.id);
  await prisma.user.update({ where: { id: created.id }, data: { passwordHash: sentinel } });

  const inviteLink = buildInviteLink(req, token);
  const mail = await sendInviteEmail({ to: created.email, name: created.name, link: inviteLink, role: ROLE_LABELS[role] || role });
  return NextResponse.json({ ...created, pending: true, inviteLink, emailSent: mail.sent, emailReason: mail.reason });
}
