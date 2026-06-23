// Logo da SASI recriada em SVG (wordmark "SASi" + ondas de sinal e ponto vermelho).
// Se você tiver o arquivo oficial (PNG/SVG), é só colocar em /public e trocar por <img>.
export default function SasiLogo({
  className = "",
  height = 36,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <svg
      className={className}
      height={height}
      viewBox="0 0 150 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="SASI"
    >
      <text
        x="0"
        y="38"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
        fontSize="42"
        fontWeight="800"
        letterSpacing="-1.5"
        fill="currentColor"
      >
        SASi
      </text>
      {/* Ondas de sinal sobre o "i" */}
      <g
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M120 16 a10 10 0 0 1 10 10" />
        <path d="M120 9 a17 17 0 0 1 17 17" />
      </g>
      {/* Ponto vermelho */}
      <circle cx="121.5" cy="24.5" r="3.6" fill="#E4322B" />
    </svg>
  );
}
