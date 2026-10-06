// "Fora da meta": o que a pessoa preencheu fora do território da meta, discriminado por
// planilha · estado. Já está somado no total da barra — aqui só mostra onde foi.
export default function ForaDaMeta({ itens }: { itens?: { rotulo: string; n: number }[] }) {
  if (!itens || itens.length === 0) return null;
  const total = itens.reduce((a, i) => a + i.n, 0);
  return (
    <div className="mt-1 text-[11px] leading-snug text-amber-700">
      <span className="font-medium">{total} fora da meta:</span>{" "}
      {itens.map((i, k) => (
        <span key={i.rotulo}>
          {k > 0 && " · "}
          {i.rotulo} <strong>{i.n}</strong>
        </span>
      ))}
    </div>
  );
}
