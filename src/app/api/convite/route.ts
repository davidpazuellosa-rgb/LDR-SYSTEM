import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseToken, verifyInvite } from "@/lib/invite";

export const dynamic = "force-dynamic";

// PÚBLICO (sem login): a pessoa define a própria senha usando o token do convite.
// A segurança vem do token (segredo de alta entropia, com hash e validade no banco).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || "");
  const password = String(body?.password || "");
  const name = body?.name ? String(body.name).trim() : undefined;

  if (password.length < 8) {
    return NextResponse.json({ error: "A senha deve ter ao menos 8 caracteres." }, { status: 400 });
  }
  const parsed = parseToken(token);
  if (!parsed) return NextResponse.json({ error: "Link inválido." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: parsed.userId }, select: { id: true, passwordHash: true } });
  if (!user) return NextResponse.json({ error: "Link inválido." }, { status: 400 });

  const check = verifyInvite(user.passwordHash, parsed.secret);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash, ...(name ? { name } : {}) } });
  return NextResponse.json({ ok: true });
}
