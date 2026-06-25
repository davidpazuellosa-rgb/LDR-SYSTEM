"use client";

import { useState } from "react";
import { apiPath } from "@/lib/path";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/permissions";
import { useToast } from "@/components/Toast";
import MetaModal from "@/components/MetaModal";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string | Date;
  pending?: boolean;
};

function asRole(role: string): Role {
  return role === "admin" ? "admin" : "ldr";
}

function initials(name: string | null, email: string) {
  const base = (name || email || "?").trim();
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  const a = parts[0]?.[0] || "?";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
}

function RolePill({ role }: { role: Role }) {
  const cls = role === "admin" ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-sky-50 text-sky-700 ring-sky-200";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${cls}`}>{ROLE_LABELS[role]}</span>;
}

const ICON = "h-[18px] w-[18px]";
function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={ICON}>
      <circle cx="8" cy="16" r="3.4" />
      <path d="M10.4 13.6 19 5" />
      <path d="m15.5 8.5 2 2" />
      <path d="m18 6 2 2" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={ICON}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7.5 8 5 8-5" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={ICON}>
      <path d="M4 7h16" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6 7v12.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export default function UsersManager({ initialUsers, selfId }: { initialUsers: User[]; selfId?: string }) {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "ldr" as Role });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [linkResult, setLinkResult] = useState<{ email: string; link: string; emailSent: boolean; reason?: string } | null>(null);
  const [metaUser, setMetaUser] = useState<{ id: string; name: string } | null>(null);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copiado!", "Envie para a pessoa concluir o cadastro.");
    } catch {
      toast.error("Não consegui copiar.", "Selecione e copie o link manualmente.");
    }
  }

  async function createInvite() {
    setError(null);
    setSaving(true);
    const loadingId = toast.loading("Gerando convite...", form.email);
    try {
      const res = await fetch(apiPath("/api/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      toast.dismiss(loadingId);
      if (!res.ok) {
        const message = data.error || `Erro ${res.status}.`;
        setError(message);
        toast.error("Não foi possível convidar.", message);
        return;
      }
      setUsers((prev) => [{ id: data.id, name: data.name, email: data.email, role: data.role, createdAt: data.createdAt, pending: true }, ...prev]);
      setOpen(false);
      setForm({ name: "", email: "", role: "ldr" });
      if (data.inviteLink) setLinkResult({ email: data.email, link: data.inviteLink, emailSent: !!data.emailSent, reason: data.emailReason });
      toast.success(data.emailSent ? "Convite enviado por e-mail." : "Convite criado.", data.email);
    } catch (err) {
      toast.dismiss(loadingId);
      const message = (err as Error).message;
      setError(message);
      toast.error("Não foi possível convidar.", message);
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(user: User, role: Role) {
    setBusyId(user.id);
    const loadingId = toast.loading("Atualizando cargo...", user.email);
    try {
      const res = await fetch(apiPath(`/api/users/${user.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => ({}));
      toast.dismiss(loadingId);
      if (!res.ok) {
        toast.error("Não foi possível atualizar cargo.", data.error || `Erro ${res.status}.`);
        return;
      }
      setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, role: data.role } : item)));
      toast.success("Cargo atualizado.", `${user.email} agora é ${ROLE_LABELS[role]}.`);
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error("Não foi possível atualizar cargo.", (err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function reinvite(user: User) {
    if (!user.pending && !confirm(`Gerar um novo link de senha para ${user.email}?\n\nAtenção: a pessoa precisará definir uma nova senha pelo link, e a senha atual deixa de funcionar.`)) return;
    setBusyId(user.id);
    const loadingId = toast.loading("Gerando link...", user.email);
    try {
      const res = await fetch(apiPath(`/api/users/${user.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reinvite" }),
      });
      const data = await res.json().catch(() => ({}));
      toast.dismiss(loadingId);
      if (!res.ok || !data.inviteLink) {
        toast.error("Não foi possível gerar o link.", data.error || `Erro ${res.status}.`);
        return;
      }
      setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, pending: true } : item)));
      setLinkResult({ email: user.email, link: data.inviteLink, emailSent: !!data.emailSent, reason: data.emailReason });
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error("Não foi possível gerar o link.", (err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(user: User) {
    if (!confirm(`Remover o acesso de ${user.email}?`)) return;
    setBusyId(user.id);
    const loadingId = toast.loading("Removendo usuário...", user.email);
    try {
      const res = await fetch(apiPath(`/api/users/${user.id}`), { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      toast.dismiss(loadingId);
      if (res.ok) {
        setUsers((prev) => prev.filter((item) => item.id !== user.id));
        toast.success("Usuário removido.", user.email);
      } else {
        toast.error("Não foi possível remover usuário.", data.error || `Erro ${res.status}.`);
      }
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error("Não foi possível remover usuário.", (err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho: legenda de cargos + ação */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          {ROLES.map((role) => (
            <div key={role} className="flex items-center gap-2 text-sm text-slate-500">
              <RolePill role={role} />
              <span>{ROLE_DESCRIPTIONS[role]}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="7" r="4" />
            <path d="M19 8v6M22 11h-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Convidar usuário
        </button>
      </div>

      {/* Lista de usuários */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1.4fr_1.6fr_1fr_0.9fr_auto] items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <div>Usuário</div>
          <div>E-mail</div>
          <div>Cargo</div>
          <div>Status</div>
          <div className="text-right">Ações</div>
        </div>
        <div className="divide-y divide-slate-100">
          {users.map((user) => {
            const isSelf = user.id === selfId;
            const busy = busyId === user.id;
            return (
              <div key={user.id} className="grid grid-cols-[1.4fr_1.6fr_1fr_0.9fr_auto] items-center gap-2 px-5 py-3.5 transition hover:bg-slate-50/60">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                    {initials(user.name, user.email)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-800">
                      {user.name || "Sem nome"}
                      {isSelf && <span className="ml-1.5 text-xs font-normal text-slate-400">(você)</span>}
                    </div>
                  </div>
                </div>
                <div className="truncate text-sm text-slate-600">{user.email}</div>
                <div>
                  <select
                    value={asRole(user.role)}
                    disabled={isSelf || busy}
                    onChange={(event) => changeRole(user, event.target.value as Role)}
                    className="w-40 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 disabled:opacity-50"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  {user.pending ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Convite pendente
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ativo
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1">
                  {asRole(user.role) === "ldr" && (
                    <button
                      onClick={() => setMetaUser({ id: user.id, name: user.name || user.email })}
                      className="mr-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-50"
                      title="Definir a meta deste LDR (por base e estado)"
                    >
                      Meta
                    </button>
                  )}
                  <button
                    onClick={() => reinvite(user)}
                    disabled={busy}
                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                    title={user.pending ? "Copiar/gerar novo link do convite" : "Enviar link para a pessoa redefinir a senha"}
                    aria-label={user.pending ? "Convite" : "Redefinir senha"}
                  >
                    {user.pending ? <MailIcon /> : <KeyIcon />}
                  </button>
                  <button
                    onClick={() => deleteUser(user)}
                    disabled={isSelf || busy}
                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                    title="Remover usuário"
                    aria-label="Remover"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: convidar */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-800">Convidar usuário</h2>
            <p className="mt-1 text-sm text-slate-500">A pessoa recebe um link e define a própria senha. Você nunca vê a senha.</p>
            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Nome</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Nome da pessoa"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">E-mail</label>
                <input
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder="email@empresa.com"
                  type="email"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Cargo</label>
                <select
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]} — {ROLE_DESCRIPTIONS[role]}
                    </option>
                  ))}
                </select>
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setOpen(false); setError(null); }}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={createInvite}
                disabled={saving || !form.email}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? "Gerando..." : "Gerar convite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: link gerado */}
      {linkResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Link do convite</h2>
            </div>
            <p className="text-sm text-slate-500">
              Envie este link para <span className="font-medium text-slate-700">{linkResult.email}</span>. Ele expira em 7 dias e
              só pode ser usado uma vez para definir a senha.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <input
                readOnly
                value={linkResult.link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-600 outline-none"
              />
              <button
                onClick={() => copy(linkResult.link)}
                className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Copiar
              </button>
            </div>
            {linkResult.emailSent ? (
              <p className="mt-3 text-xs text-emerald-600">✓ Enviado automaticamente por e-mail. O link acima serve de backup.</p>
            ) : (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-slate-400">
                  Envio automático por e-mail não ativo — por enquanto, copie e envie o link manualmente.
                </p>
                {linkResult.reason && (
                  <p className="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">Motivo: {linkResult.reason}</p>
                )}
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setLinkResult(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {metaUser && (
        <MetaModal userId={metaUser.id} userName={metaUser.name} onClose={() => setMetaUser(null)} />
      )}
    </div>
  );
}
