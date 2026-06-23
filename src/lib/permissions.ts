// Cargos (perfis) e permissões do sistema.

export type Role = "admin" | "ldr";

export const ROLES: Role[] = ["admin", "ldr"];

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  ldr: "LDR",
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Acesso total: usuários, exclusões, exportação e integrações.",
  ldr: "Pode importar e corrigir telefones. Não exclui, não exporta e não acessa áreas sensíveis.",
};

export type Action =
  | "users.manage" // criar/editar/remover usuários
  | "contacts.delete" // apagar contatos/bases
  | "data.export" // exportar dados (CSV)
  | "data.import" // importar planilhas
  | "corrections.write" // corrigir telefones / fila de correção
  | "hubspot.view"; // ver/integrar HubSpot (área sensível)

// O que o cargo LDR PODE fazer. Tudo o que não está aqui é só admin.
const LDR_ALLOWED: Action[] = ["data.import", "corrections.write"];

export function can(role: string | null | undefined, action: Action): boolean {
  if (role === "admin") return true;
  if (role === "ldr") return LDR_ALLOWED.includes(action);
  return false;
}

export function isAdmin(role: string | null | undefined): boolean {
  return role === "admin";
}
