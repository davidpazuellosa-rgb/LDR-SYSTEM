import Link from "next/link";
import FiltrosCard, { Campo, SEGMENTADO, segBtn } from "@/components/FiltrosCard";
import { PRESET_LABEL, type Preset } from "@/lib/producao-calc";

const PRESETS: Preset[] = ["hoje", "7d", "30d", "mes", "mes-passado"];

// Seletor de período (links) para as abas do LDR — `base` é a rota da aba.
export default function PeriodoLinks({ base, periodo }: { base: string; periodo: Preset }) {
  return (
    <FiltrosCard ativos={periodo !== "7d" ? 1 : 0} limparHref={base}>
      <Campo titulo="Período">
        <div className={`${SEGMENTADO} flex-wrap`}>
          {PRESETS.map((p) => (
            <Link key={p} href={p !== "7d" ? `${base}?periodo=${p}` : base} className={segBtn(periodo === p)}>
              {PRESET_LABEL[p]}
            </Link>
          ))}
        </div>
      </Campo>
    </FiltrosCard>
  );
}
