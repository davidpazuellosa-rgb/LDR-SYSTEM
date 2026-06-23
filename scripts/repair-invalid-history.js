const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const invalid = await prisma.correction.findMany({
    where: {
      status: "resolved",
      OR: [{ newValue: null }, { newValue: "" }],
    },
    select: {
      id: true,
      contactId: true,
      oldValue: true,
      newValue: true,
      resolvedAt: true,
      contact: { select: { cidade: true, estado: true, status: true } },
    },
    orderBy: { resolvedAt: "desc" },
  });

  const contactIds = [...new Set(invalid.map((item) => item.contactId).filter(Boolean))];

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        invalidHistoryRows: invalid.length,
        contactsToReturnToQueue: contactIds.length,
        examples: invalid.slice(0, 20),
      },
      null,
      2
    )
  );

  if (!APPLY || invalid.length === 0) return;

  await prisma.$transaction([
    prisma.correction.updateMany({
      where: { id: { in: invalid.map((item) => item.id) } },
      data: { status: "pending", resolvedAt: null, resolvedById: null, newValue: null },
    }),
    prisma.contact.updateMany({
      where: { id: { in: contactIds } },
      data: { status: "telefone_incorreto" },
    }),
  ]);

  console.log(`Reparo aplicado: ${invalid.length} correções voltaram para pendente.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
