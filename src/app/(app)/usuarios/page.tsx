import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { isInvitePending } from "@/lib/invite";
import { getMapaProprietarios, listarProprietarios } from "@/lib/user-proprietario";
import PageHeader from "@/components/PageHeader";
import UsersManager from "@/components/UsersManager";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdmin(role)) redirect("/dashboard"); // área sensível: só admin

  const [users, proprietarioByUser, proprietarios] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, createdAt: true, passwordHash: true },
    }),
    getMapaProprietarios(),
    listarProprietarios(),
  ]);
  const selfId = (session?.user as { id?: string } | undefined)?.id;

  return (
    <>
      <PageHeader title="Usuários" />
      <div className="p-8">
        <UsersManager
          initialUsers={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            createdAt: u.createdAt.toISOString(),
            pending: isInvitePending(u.passwordHash),
          }))}
          selfId={selfId || ""}
          proprietarios={proprietarios}
          proprietarioByUser={proprietarioByUser}
        />
      </div>
    </>
  );
}
