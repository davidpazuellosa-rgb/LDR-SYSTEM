import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";

// Restaura um contato excluído (desfazer da exclusão): limpa o deletedAt.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { deny } = await requirePermission("contacts.delete");
  if (deny) return deny;

  const { id } = await params;
  const contact = await prisma.contact.update({ where: { id }, data: { deletedAt: null } });
  return NextResponse.json(contact);
}
