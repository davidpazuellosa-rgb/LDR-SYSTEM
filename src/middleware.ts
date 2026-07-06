import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Protege as páginas: tudo exige login, exceto /login e os assets.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    // Roda em tudo, menos: rotas de API, a página pública de convite (definir-senha),
    // estáticos do Next e arquivos do /public (imagens). Excluir "definir-senha" garante
    // que o link do convite NUNCA seja redirecionado pro login (a própria página valida
    // o token) — mesmo que a checagem de auth mude no futuro.
    "/((?!api|definir-senha|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)).*)",
  ],
};
