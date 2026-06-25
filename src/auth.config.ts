import type { NextAuthConfig } from "next-auth";

// Configuração "leve" (sem banco) — usada também pelo middleware (edge).
export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
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
