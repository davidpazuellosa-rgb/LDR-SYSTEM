import type { NextAuthConfig } from "next-auth";

// Em produção (HTTPS) o app roda DENTRO de um iframe de OUTRO domínio (embarcado no
// sistema de monitoramento). O cookie de sessão padrão (SameSite=Lax) é tratado como
// "cookie de terceiro" e bloqueado nesse contexto, então o login não fixa a sessão.
// Solução: SameSite=None + Secure + Partitioned (CHIPS) — mecanismo moderno e sancionado
// para cookies em iframe cross-domínio. Em dev (localhost http) mantém o padrão do
// NextAuth (Lax, sem Secure), senão o login local quebraria.
const useSecure = process.env.NODE_ENV === "production";
const embedded = { httpOnly: true, sameSite: "none", path: "/", secure: true, partitioned: true } as const;
const embeddedCookies = useSecure
  ? ({
      sessionToken: { name: "__Secure-authjs.session-token", options: embedded },
      callbackUrl: { name: "__Secure-authjs.callback-url", options: embedded },
      csrfToken: { name: "__Host-authjs.csrf-token", options: embedded },
    } as NextAuthConfig["cookies"])
  : undefined;

// Configuração "leve" (sem banco) — usada também pelo middleware (edge).
export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  cookies: embeddedCookies,
  providers: [], // o provider real (com banco) fica no auth.ts
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;
      const isLoginPage = path.includes("/login");
      // Página pública: a pessoa convidada define a própria senha sem estar logada.
      const isConvitePage = path.includes("/definir-senha");

      if (isLoginPage) {
        // Já logado tentando ver o login -> manda pro dashboard
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }
      if (isConvitePage) return true;
      // Qualquer outra página exige login
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        // guarda id e papel no token
        // @ts-expect-error campos custom
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        // @ts-expect-error campos custom
        session.user.role = token.role;
        // @ts-expect-error campos custom
        session.user.id = token.id;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
