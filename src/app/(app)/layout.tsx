import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [bases, pending] = await Promise.all([
    prisma.base.count(),
    prisma.correction.count({ where: { status: "pending" } }),
  ]);

  const role = (session.user as { role?: string }).role || "ldr";

  return (
    <AppShell
      user={{ name: session.user.name, email: session.user.email }}
      role={role}
      badges={{ bases, pending }}
    >
      {children}
    </AppShell>
  );
}
