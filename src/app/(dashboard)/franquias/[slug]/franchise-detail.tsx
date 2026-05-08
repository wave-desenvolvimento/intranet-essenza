"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  X,
  Mail,
  Shield,
  UserCheck,
  UserX,
} from "lucide-react";
import { inviteUser, updateUser, toggleUserStatus, deleteUser } from "@/app/(dashboard)/usuarios/actions";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";

interface Role {
  id: string;
  name: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  status: string;
  is_franchise_admin: boolean;
  last_sign_in_at: string | null;
  created_at: string;
  user_roles: { role_id: string; role: Role }[];
}

interface Franchise {
  id: string;
  name: string;
  city: string | null;
  status: string;
}

interface Props {
  franchise: Franchise;
  users: UserProfile[];
  roles: Role[];
  canManageUsers: boolean;
  isSystemAdmin: boolean;
}

export function FranchiseDetail({ franchise, users, roles, canManageUsers, isSystemAdmin }: Props) {
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmAction, dialogProps } = useConfirm();

  // Form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isFranchiseAdmin, setIsFranchiseAdmin] = useState(false);
  const [status, setStatus] = useState("active");
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());

  const activeUsers = users.filter((u) => u.status === "active").length;
  const inactiveUsers = users.filter((u) => u.status === "inactive").length;

  function startCreate() {
    setEditing(null);
    setIsCreating(true);
    setFullName("");
    setEmail("");
    setIsFranchiseAdmin(false);
    setSelectedRoles(new Set());
    setError("");
  }

  function startEdit(user: UserProfile) {
    setIsCreating(false);
    setEditing(user);
    setFullName(user.full_name);
    setEmail("");
    setIsFranchiseAdmin(user.is_franchise_admin);
    setStatus(user.status);
    setSelectedRoles(new Set(user.user_roles.map((ur) => ur.role_id)));
    setError("");
  }

  function cancel() {
    setIsCreating(false);
    setEditing(null);
    setError("");
  }

  function toggleRole(id: string) {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    setError("");
    const fd = new FormData();
    fd.set("fullName", fullName);
    fd.set("franchiseId", franchise.id);
    fd.set("isFranchiseAdmin", String(isFranchiseAdmin));
    for (const rid of selectedRoles) fd.append("roleIds", rid);

    if (isCreating) {
      fd.set("email", email);
      startTransition(async () => {
        const result = await inviteUser(fd);
        if (result?.error) setError(result.error);
        else cancel();
      });
    } else if (editing) {
      fd.set("userId", editing.id);
      fd.set("email", email);
      fd.set("status", status);
      startTransition(async () => {
        const result = await updateUser(fd);
        if (result?.error) setError(result.error);
        else cancel();
      });
    }
  }

  function handleToggleStatus(userId: string) {
    startTransition(async () => {
      const result = await toggleUserStatus(userId);
      if (result?.error) setError(result.error);
    });
  }

  async function handleDelete(userId: string) {
    const ok = await confirmAction({ title: "Remover usuário", message: "Tem certeza que deseja remover este usuário? Essa ação não pode ser desfeita.", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteUser(userId);
      if (result?.error) setError(result.error);
    });
  }

  function formatDate(date: string | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }

  const isFormOpen = isCreating || editing !== null;

  return (
    <div>
      {/* Back + Header */}
      <Link
        href="/franquias"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700 transition-colors mb-4"
      >
        <ArrowLeft size={14} />
        Voltar para Franquias
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-olive-soft">
            <Building2 size={20} className="text-brand-olive" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ink-900">{franchise.name}</h1>
            <div className="flex items-center gap-3 text-sm text-ink-500">
              {franchise.city && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {franchise.city}
                </span>
              )}
              <span>{users.length} usuários</span>
              <span className="text-success">{activeUsers} ativos</span>
              {inactiveUsers > 0 && <span className="text-ink-400">{inactiveUsers} inativos</span>}
            </div>
          </div>
        </div>
        {canManageUsers && (
          <button
            onClick={startCreate}
            className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors self-start"
          >
            <Plus size={16} />
            Convidar Usuário
          </button>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Users table */}
        <div className="flex-1 overflow-x-auto rounded-xl border border-ink-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100">
                <th className="px-4 py-3 text-left font-medium text-ink-500">Usuário</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500 hidden md:table-cell">Roles</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-ink-500 hidden lg:table-cell">Último acesso</th>
                <th className="px-4 py-3 text-right font-medium text-ink-500">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-400">
                    Nenhum usuário nesta franquia
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const initial = user.full_name?.[0]?.toUpperCase() || "U";
                  return (
                    <tr
                      key={user.id}
                      className={cn(
                        "border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors",
                        editing?.id === user.id && "bg-ink-50"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white",
                            user.status === "active" ? "bg-brand-olive" : "bg-ink-300"
                          )}>
                            {initial}
                          </div>
                          <div>
                            <p className="font-medium text-ink-900">{user.full_name}</p>
                            {user.is_franchise_admin && (
                              <span className="text-[10px] font-medium text-brand-olive">Admin da franquia</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {user.user_roles.map((ur) => (
                            <span key={ur.role_id} className="rounded-full bg-brand-olive-soft px-2 py-0.5 text-[11px] font-medium text-brand-olive-dark">
                              {ur.role.name}
                            </span>
                          ))}
                          {user.user_roles.length === 0 && <span className="text-xs text-ink-400">Sem role</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(user.id)}
                          disabled={isPending}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                            user.status === "active"
                              ? "bg-success-soft text-success hover:bg-success/10"
                              : "bg-ink-100 text-ink-500 hover:bg-ink-200"
                          )}
                          aria-label="Alternar status"
                          title="Alternar status"
                        >
                          {user.status === "active" ? <><UserCheck size={11} /> Ativo</> : <><UserX size={11} /> Inativo</>}
                        </button>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-ink-500">
                        {formatDate(user.last_sign_in_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canManageUsers && (
                            <>
                              <button onClick={() => startEdit(user)} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" aria-label="Editar usuário" title="Editar usuário">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => handleDelete(user.id)} disabled={isPending} className="rounded-md p-1.5 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors" aria-label="Remover usuário" title="Remover usuário">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Form panel */}
        {isFormOpen && (
          <div className="w-full lg:w-80 shrink-0 rounded-xl border border-ink-100 bg-white p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-ink-900 flex items-center gap-2">
                {isCreating ? <><Mail size={15} className="text-brand-olive" /> Convidar Usuário</> : <><Pencil size={15} className="text-brand-olive" /> Editar Usuário</>}
              </h3>
              <button onClick={cancel} className="rounded-md p-1 text-ink-400 hover:text-ink-700 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Nome completo</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-9 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10 transition-colors" placeholder="Nome do usuário" />
              </div>

              {isCreating && (
                <div>
                  <label className="text-xs font-medium text-ink-700 mb-1 block">E-mail</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="h-9 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10 transition-colors" placeholder="email@exemplo.com" />
                </div>
              )}

              <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600 flex items-center gap-2">
                <Building2 size={13} className="text-ink-400" />
                {franchise.name}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isFranchiseAdmin} onChange={(e) => setIsFranchiseAdmin(e.target.checked)} className="sr-only" />
                <div className={cn("flex h-4 w-4 items-center justify-center rounded border-[1.5px] transition-colors", isFranchiseAdmin ? "border-brand-olive bg-brand-olive" : "border-ink-300")}>
                  {isFranchiseAdmin && <svg width="9" height="9" viewBox="0 0 9 9" className="text-white"><path d="M1 4.5L3.5 7L8 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <span className="text-xs text-ink-700">Admin desta franquia</span>
              </label>

              {editing && (
                <div>
                  <label className="text-xs font-medium text-ink-700 mb-1 block">Status</label>
                  <CustomSelect
                    options={[
                      { value: "active", label: "Ativo" },
                      { value: "inactive", label: "Inativo" },
                    ]}
                    value={status}
                    onChange={(val) => setStatus(val)}
                    placeholder="Status"
                  />
                </div>
              )}

              {/* Roles — only system admins can assign roles */}
              {isSystemAdmin && roles.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-ink-700 mb-2 block flex items-center gap-1.5">
                    <Shield size={12} /> Tipos de Acesso
                  </label>
                  <div className="flex flex-col gap-1.5">
                    {roles.map((role) => (
                      <label key={role.id} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={selectedRoles.has(role.id)} onChange={() => toggleRole(role.id)} className="sr-only" />
                        <div className={cn("flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors", selectedRoles.has(role.id) ? "border-brand-olive bg-brand-olive" : "border-ink-300")}>
                          {selectedRoles.has(role.id) && <svg width="8" height="8" viewBox="0 0 9 9" className="text-white"><path d="M1 4.5L3.5 7L8 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                        <span className="text-xs text-ink-700">{role.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {!isSystemAdmin && (
                <p className="text-[10px] text-ink-400 bg-ink-50 rounded-lg px-3 py-2">
                  Como admin de franquia, você pode convidar usuários e definir admin da franquia. Tipos de acesso avançados são gerenciados pelo administrador do sistema.
                </p>
              )}

              {isCreating && (
                <p className="text-[11px] text-ink-400 bg-ink-50 rounded-lg px-3 py-2">
                  Um e-mail de convite será enviado. O usuário definirá a própria senha.
                </p>
              )}

              {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={isPending || !fullName || (isCreating && !email)} className="flex-1 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors">
                  {isPending ? "Salvando..." : isCreating ? "Enviar Convite" : "Salvar"}
                </button>
                <button onClick={cancel} className="rounded-lg border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
