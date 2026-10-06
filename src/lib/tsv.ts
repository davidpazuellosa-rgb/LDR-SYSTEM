// Copiar/colar da planilha no formato do Excel/Sheets (TSV): células com quebra de linha,
// tabulação ou aspas vão entre aspas ("a\nb"), com aspas internas dobradas. Sem isso, uma
// célula com duas linhas (ex.: dois telefones) vira DUAS linhas ao colar e o segundo valor
// cai na linha de baixo.

export function celulaParaTSV(valor: string): string {
  return /[\t\n\r"]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

export function matrizParaTSV(linhas: string[][]): string {
  return linhas.map((l) => l.map(celulaParaTSV).join("\t")).join("\n");
}

// Lê o texto da área de transferência respeitando aspas. Se as aspas ficarem abertas
// (texto que só parece ter aspas), cai no jeito simples: uma linha por quebra de linha.
export function tsvParaMatriz(texto: string): string[][] {
  const t = texto.replace(/\r\n?/g, "\n");
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  let inicioCampo = true;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (aspas) {
      if (ch === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += ch;
      continue;
    }
    if (ch === '"' && inicioCampo) { aspas = true; inicioCampo = false; continue; }
    if (ch === "\t") { linha.push(campo); campo = ""; inicioCampo = true; continue; }
    if (ch === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; inicioCampo = true; continue; }
    campo += ch;
    inicioCampo = false;
  }
  if (aspas) return simples(t);
  linha.push(campo);
  linhas.push(linha);
  // O último "\n" do texto não cria uma linha nova.
  if (linhas.length > 1 && linhas[linhas.length - 1].length === 1 && linhas[linhas.length - 1][0] === "") linhas.pop();
  return linhas;
}

function simples(t: string): string[][] {
  const l = t.split("\n");
  if (l.length > 1 && l[l.length - 1] === "") l.pop();
  return l.map((x) => x.split("\t"));
}
