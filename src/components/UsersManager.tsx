"use client";

import { useState } from "react";
import { apiPath } from "@/lib/path";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/permissions";
import { useToast } from "@/components/Toast";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string | Date;
};

function asRole(role: string): Role {
  return role === "admin" ? "admin" : "ldr";
}

function RoleBadge({ role }: { role: Role }) {
  const cls = role === "admin" ? "bg-indigo-100 text-indigo-700" : "bg-sky-100 text-sky-700";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{ROLE_LABELS[role]}</span>;
}

export default function UsersManager({ initialUsers, selfId }: { initialUsers: User[]; selfId?: string }) {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "ldr" as Role });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function createUser() {
    setError(null);
    setSaving(true);
    const loadingId = toast.loading("Criando usuário...", "Salvando acesso no sistema.");

    try {
      const res = await fetch(apiPath("/api/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = data.error || `Erro ${res.status}.`;
        setError(message);
        toast.dismiss(loadingId);
        toast.error("Não foi possível criar usuário.", message);
        return;
      }

      setUsers((prev) => [data, ...prev]);
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "ldr" });
      toast.dismiss(loadingId);
      toast.success("Usuário criado.", data.email);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.dismiss(loadingId);
      toast.error("Não foi possível criar usuário.", message);
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

      if (!res.ok) {
        toast.dismiss(loadingId);
        toast.error("Não foi possível atualizar cargo.", data.error || `Erro ${res.status}.`);
        return;
      }

      setUsers((prev) => prev.map((item) => (item.id === user.id ? data : item)));
      toast.dismiss(loadingId);
      toast.success("Cargo atualizado.", `${user.email} agora é ${ROLE_LABELS[role]}.`);
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error("Não foi possível atualizar cargo.", (err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(user: User) {
    const password = prompt(`Nova senha para ${user.email} (mínimo 6 caracteres):`);
    if (!password) return;

    setBusyId(user.id);
    const loadingId = toast.loading("Atualizando senha...", user.email);

    try {
      const res = await fetch(apiPath(`/api/users/${user.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));

      toast.dismiss(loadingId);
      if (res.ok) toast.success("Senha atualizada.", user.email);
      else toast.error("Não foi possível atualizar senha.", data.error || `Erro ${res.status}.`);
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error("Não foi possível atualizar senha.", (err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(user: User) {
    if (!confirm(`Remover usuário ${user.email}?`)) return;

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2 text-sm text-slate-500">
          {ROLES.map((role) => (
            <div key={role} className="flex items-center gap-1.5">
              <RoleBadge role={role} />
              {ROLE_DESCRIPTIONS[role]}
            </div>
          ))}
        </div>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Novo usuário
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 font-medium text-slate-700">
                  {user.name || "Sem nome"}
                  {user.id === selfId && <span className="ml-2 text-xs text-slate-400">(você)</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{user.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={asRole(user.role)}
                    disabled={user.id === selfId || busyId === user.id}
                    onChange={(event) => changeRole(user, event.target.value as Role)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => resetPassword(user)}
                    disabled={busyId === user.id}
                    className="mr-1 rounded-lg px-2 py-1 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    Senha
                  </button>
                  <button
                    onClick={() => deleteUser(user)}
                    disabled={user.id === selfId || busyId === user.id}
                    className="rounded-lg px-2 py-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Novo usuário</h2>
            <div className="space-y-3">
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Nome"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <input
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="E-mail"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <input
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="Senha inicial"
                type="password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <select
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={createUser}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Criar usuário"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
