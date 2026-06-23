// Definição central das colunas de um contato (prefeitura).
// Usada no banco, na importação (detecção de colunas), na planilha e no HubSpot.

export type ContactField = {
  key: string;
  label: string;
  hints: string[]; // pistas para casar o cabeçalho da planilha
  width?: number; // largura sugerida da coluna na planilha (px)
};

export const CONTACT_FIELDS: ContactField[] = [
  { key: "cidade", label: "Cidade", hints: ["cidade", "municipio", "município"], width: 160 },
  { key: "estado", label: "Estado (sigla)", hints: ["estado", "uf", "sigla"], width: 110 },
  { key: "regiao", label: "Região", hints: ["regiao", "região"], width: 130 },
  { key: "populacao", label: "População aproximada", hints: ["populacao", "população", "habitantes", "pop "], width: 150 },
  { key: "telefonePrefeitura", label: "Telefone geral da prefeitura", hints: ["telefone", "fone", "tel "], width: 180 },
  { key: "emailInstitucional", label: "Email institucional", hints: ["email", "e-mail", "mail"], width: 200 },
  { key: "secretariaAdmin", label: "Secretaria de Administração", hints: ["secretaria"], width: 200 },
  { key: "nomePrefeito", label: "Nome do prefeito atual", hints: ["prefeito"], width: 180 },
  { key: "siteOficial", label: "Site oficial da prefeitura", hints: ["site", "website", "url", "portal"], width: 200 },
  { key: "whatsapp", label: "WhatsApp institucional", hints: ["whatsapp", "whats", "zap"], width: 170 },
  { key: "codigoIbge", label: "Código IBGE (6 dígitos)", hints: ["ibge"], width: 150 },
  { key: "origemContato", label: "Origem do Contato", hints: ["origem"], width: 160 },
  { key: "faseCicloVida", label: "Fase do Ciclo de Vida", hints: ["ciclo", "lifecycle", "fase"], width: 170 },
  { key: "campanha", label: "Campanha", hints: ["campanha", "campaign"], width: 150 },
  { key: "setor", label: "Setor", hints: ["setor"], width: 130 },
  { key: "departamentos", label: "Departamentos", hints: ["departamento"], width: 160 },
  { key: "solucaoInteresse", label: "Solução de Interesse", hints: ["solução de interesse", "solucao de interesse", "interesse"], width: 180 },
  { key: "prospectante", label: "Prospectante", hints: ["prospectante", "prospector", "sdr"], width: 150 },
  { key: "proprietario", label: "Proprietário", hints: ["proprietario", "proprietário", "owner", "responsavel", "responsável"], width: 150 },
];

// Campo de telefone "principal" (o que entra na fila de correção).
export const PHONE_FIELD = "telefonePrefeitura";

export const CONTACT_FIELD_KEYS = CONTACT_FIELDS.map((f) => f.key);
