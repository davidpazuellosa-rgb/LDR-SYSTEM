// Identidade de uma linha na importação — usada para não duplicar contatos
// (dentro do próprio arquivo e contra o que já está na base).
//
// Fica aqui, e não na rota, para poder ser testado sem subir o Next/Prisma.

export type DedupeContact = {
  codigoIbge?: string | null;
  cidade?: string | null;
  estado?: string | null;
  emailInstitucional?: string | null;
  telefonePrefeitura?: string | null;
};

export type LinhaImportada = { data: Record<string, string>; custom: Record<string, string> };

export function normalizeText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function onlyDigits(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

// Chave "de negócio", quando a planilha tem as colunas clássicas de contato.
export function dedupeKey(contact: DedupeContact) {
  const ibge = onlyDigits(contact.codigoIbge);
  if (ibge) return `ibge:${ibge}`;

  const cidade = normalizeText(contact.cidade);
  const estado = normalizeText(contact.estado);
  const email = normalizeText(contact.emailInstitucional);
  // Cidade+UF sozinho valia pra prefeitura (só existe uma por cidade), mas
  // descartava registros legítimos de bases onde a mesma cidade tem vários
  // contatos — ex.: consórcios (Florianópolis tem 4). O e-mail entra na chave
  // pra diferenciá-los; sem e-mail, mantém o comportamento antigo (cidade+UF).
  if (cidade && estado) return email ? `cidade:${estado}:${cidade}:${email}` : `cidade:${estado}:${cidade}`;

  if (email) return `email:${email}`;

  const phone = onlyDigits(contact.telefonePrefeitura);
  if (phone) return `telefone:${phone}`;

  return null;
}

// Identidade da linha na importação. Numa planilha LIVRE (sem cidade/UF/e-mail/
// telefone/IBGE) nenhuma das chaves acima existe — e antes a linha ficava sem
// chave e era DESCARTADA em silêncio: a importação "dava certo" e não entrava
// nada. Nesses casos a identidade passa a ser o próprio conteúdo da linha, então
// só some o que for de fato idêntico.
export function dedupeKeyDaLinha(row: LinhaImportada): string | null {
  const conhecida = dedupeKey(row.data);
  if (conhecida) return conhecida;

  const partes = [...Object.entries(row.data), ...Object.entries(row.custom)]
    .map(([k, v]) => [k, normalizeText(v)] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .sort();
  return partes.length ? `linha:${partes.join("|")}` : null;
}
