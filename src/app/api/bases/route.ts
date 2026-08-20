import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";

export async function POST(req: Request) {
  const { deny } = await requireUser();
  if (deny) return deny;

  const body = await req.json();
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const base = await prisma.base.create({
    data: {
      name,
      description: body?.description ? String(body.description) : null,
      source: "manual",
    },
  });
  return NextResponse.json(base);
}
