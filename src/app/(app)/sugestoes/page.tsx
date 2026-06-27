import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { ensureSuggestionTable } from "@/lib/suggestions";
import PageHeader from "@/components/PageHeader";
import SuggestionsList from "@/components/SuggestionsList";
import MarkSuggestionsSeen from "@/components/MarkSuggestionsSeen";

export const dynamic = "force-dynamic";

export default async function SugestoesPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdmin(role)) redirect("/dashboard"); // área sensível: só admin

  await ensureSuggestionTable();
  const sugestoes = await prisma.suggestion.findMany({ orderBy: { criadoEm: "desc" } });

  return (
    <>
      <PageHeader title="Sugestões de Melhoria" />
      <MarkSuggestionsSeen />
      <div className="p-8">
        <SuggestionsList
          initial={sugestoes.map((s) => ({
            id: s.id,
            usuarioNome: s.usuarioNome,
            texto: s.texto,
            audio: s.audio,
            status: s.status,
            criadoEm: s.criadoEm.toISOString(),
          }))}
        />
      </div>
    </>
  );
}
