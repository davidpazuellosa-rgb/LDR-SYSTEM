import Agenda from "@/components/Agenda";

export const dynamic = "force-dynamic";

// Página protegida pelo guard de sessão do (app)/layout.tsx → todos os acessos.
export default function AgendaPage() {
  return <Agenda />;
}
