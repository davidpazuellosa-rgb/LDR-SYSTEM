import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { criarTokenDeRecuperacao, consumirTokenDeRecuperacao } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Monta o link público respeitando o subcaminho (VPS da SASI usa /e-ldr).
function buildResetLink(req: Request, token: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim().replace(/^\/+|\/+$/g, "");
  const basePath = base ? `/${base}` : "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host") || "";
  return `${proto}://${host}${basePath}/recuperar-senha/${token}`;
}

// PÚBLICO — pedir o link de recuperação.
//
// Responde SEMPRE o mesmo `{ ok: true }`, exista ou não a conta. Se respondesse
// "e-mail não encontrado", a tela viraria um consultor de quem tem acesso ao sistema
// (enumeração de usuários). O mesmo motivo vale para o anti-flood: pedir de novo rápido
// demais não avisa nada, só não reenvia.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").toLowerCase().trim();
  const ok = NextResponse.json({ ok: true });

  if (!email || !email.includes("@")) return ok;

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
    if (!user) return ok;

    const token = await criarTokenDeRecuperacao(user.id);
    if (!token) return ok; // pedido repetido em menos de 1 minuto

    await sendPasswordResetEmail({ to: user.email, name: user.name, link: buildResetLink(req, token) });
  } catch (e) {
    // Falha de e-mail/banco não deve virar pista sobre a existência da conta.
    console.error("[recuperar-senha] falhou:", (e as Error).message);
  }

  return ok;
}

// PÚBLICO — gravar a senha nova usando o token do link.
export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || "");
  const password = String(body?.password || "");

  if (password.length < 8) {
    return NextResponse.json({ error: "A senha deve ter ao menos 8 caracteres." }, { status: 400 });
  }

  const check = await consumirTokenDeRecuperacao(token);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: check.userId }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
