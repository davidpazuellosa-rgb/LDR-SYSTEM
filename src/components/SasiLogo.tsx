// Logo oficial da SASI (versão negativa/branca, sem fundo) — public/sasi-logo.png
export default function SasiLogo({
  className = "",
  height = 36,
}: {
  className?: string;
  height?: number;
}) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${base}/sasi-logo.png`}
      alt="SASI"
      style={{ height }}
      className={`w-auto select-none ${className}`}
    />
  );
}
