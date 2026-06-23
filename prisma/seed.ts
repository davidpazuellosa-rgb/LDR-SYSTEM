import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@sasi.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "sasi1234";
  const name = process.env.SEED_ADMIN_NAME || "Administrador SASI";

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash, role: "admin" },
  });

  console.log(`✅ Usuário admin pronto: ${user.email}`);

  // Base inicial (vazia) seguindo a convenção: "Solução da SASI - Local".
  // Sem contatos: os dados reais são importados/cadastrados pela equipe.
  const count = await prisma.base.count();
  if (count === 0) {
    await prisma.base.create({
      data: {
        name: "Cidade na mão - Região Nordeste",
        description: "Prefeituras da Região Nordeste para prospecção do Cidade na mão.",
        source: "manual",
      },
    });
    console.log("✅ Base inicial 'Cidade na mão - Região Nordeste' criada (vazia).");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
