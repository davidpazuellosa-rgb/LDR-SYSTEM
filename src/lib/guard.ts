import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can, isAdmin, type Action } from "@/lib/permissions";

type AuthSession = {
  user?: {
    id?: string | null;
    role?: string | null;
  } | null;
} | null;

// 401
export async function requireUser() {
  const session = (await auth()) as AuthSession;
  if (!session?.user) {
    return { session: null, deny: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  }
  return { session, deny: null as null };
}

function roleOf(session: AuthSession): string | undefined {
  return session?.user?.role ?? undefined;
}

export async function requireAdmin() {
  const { session, deny } = await requireUser();
  if (deny) return { session: null, deny };
  if (!isAdmin(roleOf(session))) {
    return { session: null, deny: NextResponse.json({ error: "Acesso restrito" }, { status: 403 }) };
  }
  return { session, deny: null as null };
}

export async function requirePermission(action: Action) {
  const { session, deny } = await requireUser();
  if (deny) return { session: null, deny };
  if (!can(roleOf(session), action)) {
    return { session: null, deny: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { session, deny: null as null };
}
