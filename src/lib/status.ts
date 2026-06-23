// Situação do telefone — usando a MESMA nomenclatura do HubSpot CRM,
// para o time não precisar "traduzir" entre os dois sistemas.

export const STATUS_OK = "ok";
export const STATUS_INCORRETO = "telefone_incorreto";
export const STATUS_ATUALIZADO = "telefone_atualizado";

export type PhoneStatus = typeof STATUS_OK | typeof STATUS_INCORRETO | typeof STATUS_ATUALIZADO;

export const STATUS_META: Record<
  string,
  { label: string; dot: string; badge: string; active: string }
> = {
  [STATUS_OK]: {
    label: "Telefone OK",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600",
    active: "border-slate-400 bg-slate-50 text-slate-700",
  },
  [STATUS_INCORRETO]: {
    label: "Telefone Incorreto",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700",
    active: "border-amber-500 bg-amber-50 text-amber-700",
  },
  [STATUS_ATUALIZADO]: {
    label: "Telefone Atualizado",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
    active: "border-emerald-500 bg-emerald-50 text-emerald-700",
  },
};
