import test from "node:test";
import assert from "node:assert/strict";
import { tipoOrgao, isComplete, REQUIRED_FIELDS } from "../src/lib/completude";
import { isCampanhaAtiva } from "../src/lib/campanhas";
import { sanitizeMetas } from "../src/lib/metas-input";
import { metaFeito, metaDetalhe, territoriosCompartilhados, type Meta, type Fill, type CorrDone } from "../src/lib/meta-progress";

const completo = () =>
  Object.fromEntries(REQUIRED_FIELDS.map((f) => [f, "x"])) as Record<(typeof REQUIRED_FIELDS)[number], string | null>;

test("tipoOrgao mapeia o nome da base para o tipo de órgão", () => {
  assert.equal(tipoOrgao("Aluno a Bordo"), "Secretaria de Educação");
  assert.equal(tipoOrgao("Cidade na mão - Região Nordeste"), "Prefeitura");
  assert.equal(tipoOrgao("CIDADE NA MÃO 2026"), "Prefeitura");
  assert.equal(tipoOrgao("Secretaria de Saúde XYZ"), "Órgão"); // ainda não mapeado
});

test("isComplete só é verdadeiro com TODOS os campos da régua preenchidos", () => {
  assert.equal(isComplete(completo()), true);
  assert.equal(isComplete({ ...completo(), siteOficial: "" }), false);
  assert.equal(isComplete({ ...completo(), whatsapp: "   " }), false); // só espaços não conta
  assert.equal(isComplete({ ...completo(), cidade: null }), false);
});

test("isCampanhaAtiva reconhece só as campanhas ativas (com acento/caixa)", () => {
  assert.equal(isCampanhaAtiva("Cidade na Mão 2026"), true);
  assert.equal(isCampanhaAtiva("aluno a bordo"), true);
  assert.equal(isCampanhaAtiva("Cidade na Mao 2026"), true); // sem acento
  assert.equal(isCampanhaAtiva("Cidade na Mão 2027"), false);
  assert.equal(isCampanhaAtiva(""), false);
});

test("sanitizeMetas valida, normaliza e deduplica os dois tipos", () => {
  const out = sanitizeMetas(
    [
      { tipo: "preenchimento", baseId: "b1", regiao: "Norte", estado: "AM", prazo: "semanal", alvo: "10" },
      { tipo: "preenchimento", baseId: "b1", regiao: "Norte", estado: "AM", prazo: "mensal", alvo: 25 }, // duplicata → última vence
      { tipo: "preenchimento", baseId: "b1", regiao: "Norte", estado: "" }, // sem estado → descartada
      { tipo: "correcao", campanha: "Aluno a Bordo", prazo: "mensal", alvo: -5 }, // alvo negativo → 0
      { tipo: "correcao", campanha: "" }, // sem campanha → descartada
    ],
    "user-1"
  );
  // 1 preenchimento (deduplicado) + 1 correção
  assert.equal(out.length, 2);

  const preench = out.find((m) => m.tipo === "preenchimento")!;
  assert.equal(preench.userId, "user-1");
  assert.equal(preench.baseId, "b1");
  assert.equal(preench.estado, "AM");
  assert.equal(preench.prazo, "mensal"); // a última duplicata venceu
  assert.equal(preench.alvo, 25);
  assert.equal(preench.campanha, null);

  const corr = out.find((m) => m.tipo === "correcao")!;
  assert.equal(corr.campanha, "Aluno a Bordo");
  assert.equal(corr.alvo, 0); // clamp do negativo
  assert.equal(corr.baseId, null);
});

test("sanitizeMetas: entrada inválida vira lista vazia; alvo é truncado e limitado", () => {
  assert.deepEqual(sanitizeMetas(null, "u"), []);
  assert.deepEqual(sanitizeMetas("nope", "u"), []);
  const [m] = sanitizeMetas([{ tipo: "correcao", campanha: "Aluno a Bordo", alvo: 9_999_999 }], "u");
  assert.equal(m.alvo, 1_000_000); // teto
});

test("metaFeito (preenchimento): conta tudo que a pessoa completou no período; o que está fora do território vai em `fora`", () => {
  const now = new Date("2026-06-25T12:00:00");
  const recente = now;
  const antigo = new Date(now.getTime() - 60 * 24 * 3600 * 1000); // fora da semana e do mês

  const meta: Meta = { id: "m", userId: "u1", tipo: "preenchimento", baseId: "b1", regiao: "Norte", estado: "AM", campanha: null, prazo: "semanal", alvo: 5 };
  const fills: Fill[] = [
    { concluidoEm: recente, baseId: "b1", regiao: "Norte", estado: "AM", porId: "u1" }, // na meta
    { concluidoEm: recente, baseId: "b1", regiao: "Norte", estado: "PA", porId: "u1" }, // outro estado → conta, mas fora da meta
    { concluidoEm: recente, baseId: "b2", regiao: "Norte", estado: "AM", porId: "u1" }, // outra base → conta, fora da meta
    { concluidoEm: recente, baseId: "b1", regiao: "Norte", estado: "AM", porId: "u2" }, // de outra pessoa → não
    { concluidoEm: antigo, baseId: "b1", regiao: "Norte", estado: "AM", porId: "u1" }, // fora do período → não
  ];
  assert.equal(metaFeito(meta, now, fills, []), 3);
  assert.deepEqual(metaDetalhe(meta, now, fills, []), { feito: 3, naMeta: 1, fora: 2 });
  assert.equal(metaFeito({ ...meta, prazo: "mensal" }, now, fills, []), 3);
});

test("metaFeito (correção): conta correções resolvidas pelo LDR na campanha, no período", () => {
  const now = new Date("2026-06-25T12:00:00");
  const recente = now;
  const antigo = new Date(now.getTime() - 60 * 24 * 3600 * 1000);

  const meta: Meta = { id: "m", userId: "u1", tipo: "correcao", baseId: null, regiao: null, estado: null, campanha: "Aluno a Bordo", prazo: "semanal", alvo: 3 };
  const corrs: CorrDone[] = [
    { resolvedById: "u1", resolvedAt: recente, campanha: "Aluno a Bordo" }, // conta
    { resolvedById: "u2", resolvedAt: recente, campanha: "Aluno a Bordo" }, // outro LDR → não
    { resolvedById: "u1", resolvedAt: recente, campanha: "Cidade na Mão 2026" }, // outra campanha → não
    { resolvedById: "u1", resolvedAt: antigo, campanha: "Aluno a Bordo" }, // fora do período → não
  ];
  assert.equal(metaFeito(meta, now, [], corrs), 1);
});

test("território de uma pessoa só: o que outra pessoa completou não entra na meta dela", () => {
  const meta = { id: "m", userId: "u1", tipo: "preenchimento", baseId: "b1", regiao: "Norte", estado: "AM", campanha: null, prazo: "semanal", alvo: 10 } as Meta;
  const now = new Date();
  const fills = [
    { concluidoEm: now, baseId: "b1", regiao: "Norte", estado: "AM", porId: "u1" },
    { concluidoEm: now, baseId: "b1", regiao: "Norte", estado: "AM", porId: "outro" },
  ];
  assert.equal(metaFeito(meta, now, fills, []), 1);
});

test("mesmo estado para 2 pessoas: cada uma conta só o que ela completou", () => {
  const m1 = { id: "m1", userId: "u1", tipo: "preenchimento", baseId: "b1", regiao: "Norte", estado: "AM", campanha: null, prazo: "semanal", alvo: 10 } as Meta;
  const m2 = { ...m1, id: "m2", userId: "u2" } as Meta;
  const now = new Date();
  const fills = [
    { concluidoEm: now, baseId: "b1", regiao: "Norte", estado: "AM", porId: "u1" },
    { concluidoEm: now, baseId: "b1", regiao: "Norte", estado: "AM", porId: "u1" },
    { concluidoEm: now, baseId: "b1", regiao: "Norte", estado: "AM", porId: "u2" },
  ];
  assert.equal(metaFeito(m1, now, fills, []), 2);
  assert.equal(metaFeito(m2, now, fills, []), 1);
});

test("meta da planilha inteira (estado '*'): conta qualquer linha da base, mesmo sem estado/região", () => {
  const meta = { id: "m", userId: "u1", tipo: "preenchimento", baseId: "b1", regiao: "Norte", estado: "*", campanha: null, prazo: "semanal", alvo: 10 } as Meta;
  const now = new Date();
  const fills = [
    { concluidoEm: now, baseId: "b1", regiao: null, estado: null, porId: "u1" }, // planilha sem campos de território
    { concluidoEm: now, baseId: "b1", regiao: "Sul", estado: "RS", porId: "u1" },
    { concluidoEm: now, baseId: "b2", regiao: "Norte", estado: "AM", porId: "u1" }, // outra planilha → não
  ];
  assert.deepEqual(metaDetalhe(meta, now, fills, []), { feito: 3, naMeta: 2, fora: 1 }); // a outra planilha conta, como "fora"
});

test("meta por estado continua exigindo região+estado (nada mudou para as metas antigas)", () => {
  const meta = { id: "m", userId: "u1", tipo: "preenchimento", baseId: "b1", regiao: "Norte", estado: "AM", campanha: null, prazo: "semanal", alvo: 10 } as Meta;
  const now = new Date();
  const fills = [
    { concluidoEm: now, baseId: "b1", regiao: "Norte", estado: "AM", porId: "u1" },
    { concluidoEm: now, baseId: "b1", regiao: null, estado: null, porId: "u1" },
  ];
  assert.deepEqual(metaDetalhe(meta, now, fills, []), { feito: 2, naMeta: 1, fora: 1 });
});
