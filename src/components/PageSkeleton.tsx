// Esqueleto genérico mostrado INSTANTANEAMENTE ao trocar de página (loading.tsx do
// App Router), enquanto o servidor busca os dados de verdade. Sem isto, a navegação
// parece travada: a tela antiga some e fica em branco até tudo carregar — com isto,
// aparece algo na hora, e a sensação de demora cai bastante mesmo sem a consulta em
// si ficar mais rápida.
const pulse = "animate-pulse rounded-lg bg-slate-200/70";

export function CardsSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 p-8 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className={`h-11 w-11 ${pulse}`} />
          <div className={`mt-4 h-6 w-16 ${pulse}`} />
          <div className={`mt-2 h-3 w-24 ${pulse}`} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-8">
      <div className={`h-8 w-56 ${pulse}`} />
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-0">
            <div className={`h-4 w-1/4 ${pulse}`} />
            <div className={`h-4 w-1/6 ${pulse}`} />
            <div className={`h-4 w-1/5 ${pulse}`} />
            <div className={`h-4 flex-1 ${pulse}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Planilha: barra de ferramentas + grade — a tela mais pesada do sistema.
export function SheetSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className={`h-9 w-full max-w-2xl ${pulse}`} />
      <div className={`h-full w-full ${pulse}`} />
    </div>
  );
}

export default function PageSkeleton() {
  return (
    <>
      <div className="px-8 pt-6 pb-2">
        <div className={`h-7 w-40 ${pulse}`} />
      </div>
      <CardsSkeleton />
    </>
  );
}
