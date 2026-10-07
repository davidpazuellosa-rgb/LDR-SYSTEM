import Link from "next/link";
import { PRESET_LABEL, type Preset } from "@/lib/producao-calc";

const PRESETS: Preset[] = ["hoje", "7d", "30d", "mes", "mes-passado"];

// Seletor de período (links) para as abas do LDR — `base` é a rota da aba.
export default function PeriodoLinks({ base, periodo }: { base: string; periodo: Preset }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-0.5">
      {PRESETS.map((p) => (
        <Link
          key={p}
          href={p !== "7d" ? `${base}?periodo=${p}` : base}
          className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${periodo === p ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800"}`}
        >
          {PRESET_LABEL[p]}
        </Link>
      ))}
    </div>
  );
}
