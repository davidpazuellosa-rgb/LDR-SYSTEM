import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { ROLES } from "@/lib/permissions";

// Edita um usuário: nome, cargo e/ou senha (admin).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, deny } = await requireAdmin();
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, string> = {};

  if (typeof body?.name === "string") data.name = body.name.trim();
  if (body?.role && ROLES.includes(body.role)) {
    // Impede o admin de rebaixar a si mesmo (evita ficar sem nenhum admin por engano).
    const selfId = (session.user as { id?: string }).id;
    if (id === selfId && body.role !== "admin") {
      return NextResponse.json({ error: "Você não pode alterar o seu próprio cargo." }, { status: 400 });
    }
    data.role = body.role;
  }
  if (body?.password) {
    if (String(body.password).length < 6) {
      return NextResponse.json({ error: "A senha deve ter ao menos 6 caracteres." }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(String(body.password), 10);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
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
