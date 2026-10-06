import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularHorarios } from "../src/lib/horarios";

// 2026-09-29 é terça. 17:00 UTC = 14:00 em Brasília.
const d = (iso: string) => new Date(iso);

test("hora é em horário de Brasília (UTC-3)", () => {
  const h = calcularHorarios([d("2026-09-29T17:00:00Z")]);
  assert.equal(h.porHora[14], 1);
  assert.equal(h.porHora[17], 0);
});

test("virada de dia: 01:00 UTC ainda é 22h do dia anterior em Brasília", () => {
  const h = calcularHorarios([d("2026-09-30T01:00:00Z")]); // quarta 01:00 UTC = terça 22h BRT
  assert.equal(h.porHora[22], 1);
  assert.equal(h.porDiaSemana[1], 1); // terça
  assert.equal(h.melhorDia?.nome, "terça");
});

test("melhor janela de 2h e turnos", () => {
  const eventos = [
    ...Array(5).fill(d("2026-09-29T17:10:00Z")), // 14h
    ...Array(3).fill(d("2026-09-29T18:10:00Z")), // 15h
    d("2026-09-29T11:00:00Z"), // 08h
  ];
  const h = calcularHorarios(eventos);
  assert.deepEqual(h.melhorJanela, { de: 14, ate: 16, qtd: 8, pct: 89 });
  assert.equal(h.turnos.tarde, 8);
  assert.equal(h.turnos.manha, 1);
  assert.match(h.frases[0], /14h e 16h/);
});

test("sem produção: não quebra e avisa", () => {
  const h = calcularHorarios([]);
  assert.equal(h.total, 0);
  assert.equal(h.melhorJanela, null);
  assert.equal(h.pico, 1);
  assert.match(h.frases[0], /Sem produção/);
});

test("tema validação: as frases falam de validações, não de produção", () => {
  const h = calcularHorarios([new Date("2026-09-29T17:00:00Z")], "validacao");
  assert.ok(h.frases.some((f) => f.startsWith("Mais validações entre")));
  assert.ok(h.frases.some((f) => f.includes("Turno com mais validações")));
  assert.match(calcularHorarios([], "validacao").frases[0], /Sem validações/);
  // sem o tema, nada muda
  assert.ok(calcularHorarios([new Date("2026-09-29T17:00:00Z")]).frases[0].startsWith("Mais produtivo"));
});
