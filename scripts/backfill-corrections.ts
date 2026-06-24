/**
 * Backfill: cria registros de Correction para contatos com status
 * "telefone_incorreto" que ainda não têm correção pendente na fila.
 *
 * Uso:
 *   npx tsx scripts/backfill-corrections.ts          # dry-run (mostra o que faria)
 *   npx tsx scripts/backfill-corrections.ts --apply  # aplica de verdade
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  // Contatos com telefone incorreto que não têm correção pendente
  const contacts = await prisma.contact.findMany({
    where: {
      status: "telefone_incorreto",
      deletedAt: null,
      corrections: { none: { status: "pending" } },
    },
    select: { id: true, cidade: true, estado: true, telefonePrefeitura: true },
  });

  console.log(`Contatos sem correção pendente: ${contacts.length}`);

  if (contacts.length === 0) {
    console.log("Nada a fazer.");
    return;
  }

  console.log("Exemplos:");
  contacts.slice(0, 5).forEach((c) =>
    console.log(`  ${c.cidade}/${c.estado} — tel: ${c.telefonePrefeitura ?? "(vazio)"}`)
  );

  if (!apply) {
    console.log('\nDry-run. Rode com --apply para criar as correções.');
    return;
  }

  const result = await prisma.correction.createMany({
    data: contacts.map((c) => ({
      contactId: c.id,
      field: "telefonePrefeitura",
      oldValue: c.telefonePrefeitura,
      reason: "Telefone inválido detectado na importação",
      status: "pending",
    })),
  });

  console.log(`\n✓ ${result.count} correções criadas.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
