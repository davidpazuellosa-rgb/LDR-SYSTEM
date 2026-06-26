import { redirect } from "next/navigation";

// A página de HubSpot deixou de existir: a integração agora vive como uma seção
// dentro de Configurações. Mantemos esta rota só para redirecionar links antigos.
export default function HubspotRedirect() {
  redirect("/configuracoes");
}
