import { redirect } from "next/navigation";

// Usuários agora é uma aba de Configurações (mantém links antigos funcionando).
export default function UsuariosPage() {
  redirect("/configuracoes?aba=usuarios");
}
