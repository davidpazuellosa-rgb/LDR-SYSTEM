import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { currentRole } from "@/lib/current-role";
import { ensureSuggestionTable } from "@/lib/suggestions";
import { statusMinhasMetas } from "@/lib/minhas-metas";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Cargo lido do banco (reflete mudança de cargo sem re-login). Só leitura.
  const role = (await currentRole(session)) || "ldr";
  const admin = isAdmin(role);

  // Sugestões "novas" = criadas DEPOIS da última vez que o admin abriu a página
  // (marcado por cookie ao visitar /sugestoes). Some ao ver; reaparece só quando
  // chega uma sugestão nova — não depende de estar "resolvida".
  async function contarSugestoesNovas() {
    if (!admin) return 0;
    await ensureSuggestionTable();
    const seen = (await cookies()).get("sug_seen_at")?.value;
    const seenAt = seen ? new Date(Number(seen)) : new Date(0);
    return prisma.suggestion.count({ where: { criadoEm: { gt: seenAt } } });
  }

  const meId = (session.user as { id?: string }).id || "";

  const [bases, pending, sugestoes, metas] = await Promise.all([
    prisma.base.count(),
    prisma.correction.count({ where: { status: "pending" } }),
    contarSugestoesNovas(),
    meId ? statusMinhasMetas(meId) : Promise.resolve({ status: null, nova: false }),
  ]);

  return (
    <AppShell
      user={{ name: session.user.name, email: session.user.email }}
      role={role}
      badges={{ bases, pending, sugestoes, metasStatus: metas.status, metaNova: metas.nova }}
    >
      {children}
    </AppShell>
  );
}
