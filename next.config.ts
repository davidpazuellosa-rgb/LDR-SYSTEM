import type { NextConfig } from "next";

// basePath permite publicar em subcaminho no nginx do VPS (ex.: /sasi-ldr/).
// Deixe vazio para rodar na raiz "/" (recomendado usar subdomínio em produção).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  // "standalone" gera um build enxuto, ideal para a imagem Docker do VPS.
  output: "standalone",
  basePath: basePath || undefined,
};

export default nextConfig;
