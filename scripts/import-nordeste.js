// Importador da planilha "CNM - Prefeituras Região Nordeste" (xlsx, 1 guia por estado).
// Mapeia por POSIÇÃO (as 19 colunas estão na mesma ordem das colunas do sistema).
const path = require("path");
const XLSX = require(path.join(__dirname, "..", "node_modules", "xlsx"));
const { PrismaClient } = require(path.join(__dirname, "..", "node_modules", "@prisma/client"));

const prisma = new PrismaClient();

// Mesma ordem de src/lib/contact-fields.ts
const FIELD_KEYS = [
  "cidade", "estado", "regiao", "populacao", "telefonePrefeitura",
  "emailInstitucional", "secretariaAdmin", "nomePrefeito", "siteOficial",
  "whatsapp", "codigoIbge", "origemContato", "faseCicloVida", "campanha",
  "setor", "departamentos", "solucaoInteresse", "prospectante", "proprietario",
];

const FILE = "/Users/davidpazuello/Downloads/CNM - Prefeituras Regiao nordeste.xlsx";
const BASE_NAME = "Cidade na mão - Região Nordeste";

function validPhone(v) {
  if (!v) return false;
  const d = String(v).replace(/\D/g, "");
  return d.length >= 10 && d.length <= 13;
}

async function main() {
  const wb = XLSX.readFile(FILE);

  let base = await prisma.base.findFirst({ where: { name: BASE_NAME } });
  if (!base) {
    base = await prisma.base.create({
      data: { name: BASE_NAME, description: "Prefeituras da Região Nordeste para prospecção do Cidade na mão.", source: "import" },
    });
  }
  const admin = await prisma.user.findFirst({ where: { role: "admin" } });

  const perState = {};
  let total = 0;
  let invalid = 0;

  for (const uf of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[uf], { header: 1, defval: "", blankrows: false, raw: false });
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const line = rows[i];
      const rec = { baseId: base.id };
      FIELD_KEYS.forEach((key, idx) => {
        const val = String(line[idx] ?? "").trim();
        rec[key] = val || null;
      });
      if (!rec.cidade) continue;
      rec.estado = uf;            // usa a sigla da guia (AL, BA, ...)
      rec.regiao = rec.regiao || "Nordeste";
      const ok = validPhone(rec.telefonePrefeitura);
      rec.status = ok ? "ok" : "phone_invalid";
      if (!ok) invalid++;
      data.push(rec);
    }
    if (data.length) {
      await prisma.contact.createMany({ data });
      perState[uf] = data.length;
      total += data.length;
    }
  }

  // Cria entradas na fila de correção para telefones inválidos (sem correção ainda).
  const invalids = await prisma.contact.findMany({
    where: { baseId: base.id, status: "phone_invalid", corrections: { none: {} } },
    select: { id: true, telefonePrefeitura: true },
  });
  if (invalids.length) {
    await prisma.correction.createMany({
      data: invalids.map((c) => ({
        contactId: c.id,
        field: "telefonePrefeitura",
        oldValue: c.telefonePrefeitura,
        reason: "Telefone ausente/inválido na importação",
        status: "pending",
        createdById: admin ? admin.id : null,
      })),
    });
  }

  console.log("Base:", base.name);
  console.log("Por estado:", JSON.stringify(perState));
  console.log("Total importado:", total);
  console.log("Telefones inválidos -> fila de correção:", invalids.length);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
