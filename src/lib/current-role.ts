import { prisma } from "@/lib/prisma";

// Papel (cargo) ATUAL do usuário, lido do banco — reflete uma mudança de cargo SEM
// precisar re-logar. É SÓ LEITURA: nunca modifica o token/sessão (modificar o token
// faz o NextAuth tentar regravar o cookie, o que NÃO é permitido durante o render de
// um Server Component e derruba a página). Seguro: é só mais um SELECT, como os que o
// layout já faz. Se o banco falhar, cai no papel que veio na sessão.
type SessionLike = { user?: { id?: string | null; role?: string | null } | null } | null;

export async function currentRole(session: SessionLike): Promise<string | undefined> {
  const fallback = session?.user?.role || undefined;
  const id = session?.user?.id;
  if (!id) return fallback;
  try {
    const u = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    return u?.role ?? fallback;
  } catch {
    return fallback;
  }
}
