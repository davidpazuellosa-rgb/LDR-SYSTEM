// Campanhas ativas do sistema (HubSpot). As demais ("Cidade na Mão 2027/2029/2033…",
// 1 contato cada) são ruído de dados e não devem aparecer nos seletores.
// Fonte única usada pela Correção de Contatos e pelas Metas.
export const CAMPANHAS_ATIVAS = ["Cidade na Mão 2026", "Aluno a Bordo"];

export const normCampanha = (value: string | null | undefined) =>
  (value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export const isCampanhaAtiva = (name: string | null | undefined) =>
  CAMPANHAS_ATIVAS.some((c) => normCampanha(c) === normCampanha(name));
