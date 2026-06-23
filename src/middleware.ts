import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Protege as páginas: tudo exige login, exceto /login e os assets.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    // Roda em tudo, menos rotas de API, arquivos estáticos e imagens.
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
