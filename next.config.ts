import type { NextConfig } from "next";

// basePath permite publicar em subcaminho no nginx do VPS (ex.: /sasi-ldr/).
// Deixe vazio para rodar na raiz "/" (recomendado usar subdomínio em produção).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Identificador desta publicação: vai embutido no código do navegador (NEXT_PUBLIC_BUILD_ID) e é
// devolvido por /api/versao. Quando as duas pontas diferem, a tela avisa "nova versão disponível".
const BUILD_ID = process.env.BUILD_ID || Date.now().toString(36);

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  generateBuildId: async () => BUILD_ID,
  // "standalone" gera um build enxuto, ideal para a imagem Docker do VPS.
  output: "standalone",
  basePath: basePath || undefined,
};

export default nextConfig;
