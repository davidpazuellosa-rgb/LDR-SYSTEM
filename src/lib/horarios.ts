// Cálculo PURO (sem banco) dos relatórios de horário: em que hora/dia a pessoa mais
// produz. Tudo em horário de Brasília (UTC-3). A hora vem de QUANDO a linha ficou
// completa (ContactFill) ou a correção foi resolvida — não de cada digitação.
const BRT = 3 * 3600000;
const DIAS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

export type Horarios = {
  total: number;
  porHora: number[]; // 24
  mapa: number[][]; // [dia da semana (seg=0)][hora]
  porDiaSemana: number[]; // 7
  turnos: { madrugada: number; manha: number; tarde: number; noite: number };
  melhorJanela: { de: number; ate: number; qtd: number; pct: number } | null; // 2h seguidas
  melhorDia: { nome: string; qtd: number } | null;
  pico: number; // maior valor do mapa (para a escala de cor)
  frases: string[];
};

const hh = (h: number) => `${String(h % 24).padStart(2, "0")}h`;

export function calcularHorarios(quandos: Date[]): Horarios {
  const porHora = new Array(24).fill(0) as number[];
  const mapa: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const porDiaSemana = new Array(7).fill(0) as number[];
  for (const q of quandos) {
    const b = new Date(q.getTime() - BRT);
    const h = b.getUTCHours();
    const d = (b.getUTCDay() + 6) % 7;
    porHora[h]++;
    mapa[d][h]++;
    porDiaSemana[d]++;
  }
  const total = quandos.length;
  const soma = (a: number, b: number) => porHora.slice(a, b).reduce((x, y) => x + y, 0);
  const turnos = { madrugada: soma(0, 6), manha: soma(6, 12), tarde: soma(12, 18), noite: soma(18, 24) };

  let melhorJanela: Horarios["melhorJanela"] = null;
  if (total > 0) {
    let best = -1, de = 0;
    for (let h = 0; h < 24; h++) {
      const v = porHora[h] + porHora[(h + 1) % 24];
      if (v > best) { best = v; de = h; }
    }
    melhorJanela = { de, ate: (de + 2) % 24, qtd: best, pct: Math.round((best / total) * 100) };
  }
  let melhorDia: Horarios["melhorDia"] = null;
  if (total > 0) {
    const i = porDiaSemana.indexOf(Math.max(...porDiaSemana));
    melhorDia = { nome: DIAS[i], qtd: porDiaSemana[i] };
  }

  const frases: string[] = [];
  if (melhorJanela) frases.push(`Mais produtivo entre ${hh(melhorJanela.de)} e ${hh(melhorJanela.ate)} (${melhorJanela.pct}% do total).`);
  if (melhorDia) frases.push(`Melhor dia da semana: ${melhorDia.nome} (${melhorDia.qtd}).`);
  if (total > 0) {
    const t = Object.entries(turnos).sort((a, b) => b[1] - a[1])[0];
    const nome = { madrugada: "madrugada", manha: "manhã", tarde: "tarde", noite: "noite" }[t[0] as keyof typeof turnos];
    frases.push(`Turno com mais produção: ${nome} (${Math.round((t[1] / total) * 100)}%).`);
  } else {
    frases.push("Sem produção no período para calcular horários.");
  }
  return { total, porHora, mapa, porDiaSemana, turnos, melhorJanela, melhorDia, pico: Math.max(1, ...mapa.flat()), frases };
}
