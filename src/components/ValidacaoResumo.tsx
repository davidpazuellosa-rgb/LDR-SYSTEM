// Resumo de validação (Sim · Não · a validar) com barra empilhada. Usado nos cards de Bases.
export type ValidacaoContagem = { sim: number; nao: number; aValidar: number };

const nf = (n: number) => n.toLocaleString("pt-BR");

export default function ValidacaoResumo({ v }: { v: ValidacaoContagem }) {
  const total = v.sim + v.nao + v.aValidar;
  if (total === 0) return null;
  const feitos = v.sim + v.nao;
  const pct = Math.round((feitos / total) * 100);
  return (
    <div className="mt-3" title="Contatos validados por ligação">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-slate-600">Validados</span>
        <span className="tabular-nums text-slate-500">{pct}% ({nf(feitos)} de {nf(total)})</span>
      </div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-emerald-500" style={{ width: `${(v.sim / total) * 100}%` }} />
        <div className="h-full bg-red-400" style={{ width: `${(v.nao / total) * 100}%` }} />
      </div>
      <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
        <span className="text-emerald-700"><strong>{nf(v.sim)}</strong> Sim</span>
        <span className="text-red-600"><strong>{nf(v.nao)}</strong> Não</span>
        <span className="text-slate-500"><strong>{nf(v.aValidar)}</strong> a validar</span>
      </p>
    </div>
  );
}
