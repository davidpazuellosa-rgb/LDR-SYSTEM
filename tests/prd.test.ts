import test from "node:test";
import assert from "node:assert/strict";
import { secoesPrd } from "../src/lib/prd";

test("PRD: admin recebe todas as partes; quem não é admin NÃO recebe as internas (15, 16, 18, 19, 20)", () => {
  const admin = secoesPrd(true).secoes;
  const outros = secoesPrd(false).secoes;
  const restritas = [15, 16, 18, 19, 20];
  for (const n of restritas) {
    assert.ok(admin.some((s) => s.n === n), `admin deve ver a parte ${n}`);
    assert.ok(!outros.some((s) => s.n === n), `não-admin não pode ver a parte ${n}`);
  }
  assert.equal(admin.length, 20);
  assert.equal(outros.length, 15);
});

test("PRD: o conteúdo restrito não vai nem no HTML nem no texto de busca de quem não é admin", () => {
  const out = secoesPrd(false);
  const tudo = out.intro + out.secoes.map((s) => s.html + s.texto).join(" ");
  for (const marca of ["Riscos e dívidas técnicas", "Roadmap de melhorias", "Registro de decisões", "Rascunho de política de retenção", "Modelo de dados (tabelas)"]) {
    assert.ok(!tudo.includes(marca), `"${marca}" não pode aparecer para não-admin`);
  }
});

test("PRD: seções renderizam HTML (tabelas e listas) e o documento não cita hospedagem", () => {
  const { secoes } = secoesPrd(true);
  assert.ok(secoes.every((s) => s.html.length > 50));
  assert.ok(secoes.some((s) => s.html.includes("<table")));
  assert.ok(secoes.some((s) => s.html.includes("<li>")));
  const tudo = secoes.map((s) => s.html).join(" ").toLowerCase();
  assert.ok(!/\bvps\b/.test(tudo), "o PRD não deve mencionar VPS");
  assert.ok(!/vercel|supabase|sslip/.test(tudo), "o PRD não deve citar hospedagem/serviços de infraestrutura");
});

test("PRD: quem não é admin não lê limiares de alerta nem lacunas de segurança de login", () => {
  const out = secoesPrd(false);
  const tudo = (out.intro + out.secoes.map((s) => s.html + s.texto).join(" ")).toLowerCase();
  for (const marca of ["100 créditos", "300 em 24", "limita tentativas", "sem 2fa", "sem limite de tentativas"]) {
    assert.ok(!tudo.includes(marca), `"${marca}" não pode aparecer para não-admin`);
  }
});
