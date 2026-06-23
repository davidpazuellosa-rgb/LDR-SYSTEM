// Prefixa chamadas de API com o basePath (quando publicado em subcaminho no nginx).
// O basePath NÃO é aplicado automaticamente em fetch(), por isso este helper.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function apiPath(path: string): string {
  return `${BASE_PATH}${path}`;
}
