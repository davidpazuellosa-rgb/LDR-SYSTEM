import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
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

  const role = (session.user as { role?: string }).role || "ldr";
  const admin = isAdmin(role);

  // Sugestões "novas" (ainda não resolvidas) — só interessa ao admin (que as lê).
  async function contarSugestoesNovas() {
    if (!admin) return 0;
    await ensureSuggestionTable();
    return prisma.suggestion.count({ where: { status: "nova" } });
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
