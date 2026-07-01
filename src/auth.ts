import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { isInvitePending } from "@/lib/invite";

async function ensureSeedAdmin(email: string, password: string) {
  const seedEmail = (process.env.SEED_ADMIN_EMAIL || "admin@sasi.com").toLowerCase().trim();
  const seedPassword = process.env.SEED_ADMIN_PASSWORD || "sasi1234";

  if (email !== seedEmail || password !== seedPassword) return null;

  const passwordHash = await bcrypt.hash(seedPassword, 10);

  return prisma.user.upsert({
    where: { email: seedEmail },
    update: {
      name: process.env.SEED_ADMIN_NAME || "Administrador SASI",
      role: "admin",
      passwordHash,
    },
    create: {
      email: seedEmail,
      name: process.env.SEED_ADMIN_NAME || "Administrador SASI",
      role: "admin",
      passwordHash,
    },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").toLowerCase().trim();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        let user = existingUser || (await ensureSeedAdmin(email, password));
        if (!user) return null;

        // Conta convidada que ainda não definiu a senha não pode logar.
        if (isInvitePending(user.passwordHash)) return null;

        let ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          const seedAdmin = await ensureSeedAdmin(email, password);
          if (!seedAdmin) return null;
          user = seedAdmin;
          ok = true;
        }

        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Refresca o papel (role) direto do banco a cada request (runtime Node) — assim
    // uma mudança de cargo (ex.: virar Pré-vendedor) passa a valer SEM re-login.
    async jwt({ token, user }) {
      const t = token as { role?: string; id?: string };
      if (user) {
        const u = user as { role?: string; id?: string };
        t.role = u.role;
        t.id = u.id;
        return token;
      }
      if (t.id) {
        const dbUser = await prisma.user.findUnique({ where: { id: t.id }, select: { role: true } });
        if (dbUser) t.role = dbUser.role;
      }
      return token;
    },
  },
});
