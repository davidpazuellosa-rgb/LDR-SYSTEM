// Prefixa chamadas de API com o basePath quando o app roda em subcaminho no nginx.
const CONFIGURED_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

const ROOT_ROUTES = new Set([
  "bases",
  "configuracoes",
  "correcoes",
  "dashboard",
  "historico-correcoes",
  "hubspot",
  "login",
  "usuarios",
]);

function normalizeBasePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function inferBrowserBasePath() {
  if (typeof window === "undefined") return "";

  const [first, second] = window.location.pathname.split("/").filter(Boolean);
  if (!first) return "";

  if (first === "sasi-ldr") return "/sasi-ldr";
  if (second && ROOT_ROUTES.has(second) && !ROOT_ROUTES.has(first)) return `/${first}`;

  return "";
}

// Prefixo do app (vazio na Vercel, "/e-ldr" no VPS da SASI). Necessário para montar
// rotas que o Next NÃO prefixa sozinho — os redirecionamentos do NextAuth e a URL das
// rotas de login usadas pelo navegador.
export function appBasePath(): string {
  return normalizeBasePath(CONFIGURED_BASE_PATH) || inferBrowserBasePath();
}

export function apiPath(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const basePath = normalizeBasePath(CONFIGURED_BASE_PATH) || inferBrowserBasePath();

  return `${basePath}${normalizedPath}`;
}
