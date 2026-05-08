"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Search,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Building2,
} from "lucide-react";
import { toggleUserStatus, deleteUser } from "./actions";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";

interface Franchise {
  id: string;
  name: string;
  slug: string;
}

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
  franchise: Franchise | null;
  user_roles: { role_id: string; role: Role }[];
}

interface Props {
  users: UserProfile[];
  franchises: Franchise[];
  roles: Role[];
}

export function UsersManager({ users, franchises }: Props) {
  const [search, setSearch] = useState("");
  const [filterFranchise, setFilterFranchise] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmAction, dialogProps } = useConfirm();

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.id.includes(search);
    const matchFranchise = !filterFranchise || u.franchise?.id === filterFranchise;
    const matchStatus = !filterStatus || u.status === filterStatus;
    return matchSearch && matchFranchise && matchStatus;
  });

  // Stats
  const totalActive = users.filter((u) => u.status === "active").length;
  const totalInactive = users.filter((u) => u.status === "inactive").length;

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
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Usuários</h1>
          <p className="text-sm text-ink-500">
            {users.length} usuários · {totalActive} ativos · {totalInactive} inativos
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
        <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white py-1 px-3 h-9 flex-1">
          <Search size={14} className="text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none"
          />
        </div>
        <CustomSelect
          options={[
            { value: "", label: "Todas franquias" },
            ...franchises.map((f) => ({ value: f.id, label: f.name })),
          ]}
          value={filterFranchise}
          onChange={(val) => setFilterFranchise(val)}
          placeholder="Todas franquias"
        />
        <CustomSelect
          options={[
            { value: "", label: "Todos status" },
            { value: "active", label: "Ativos" },
            { value: "inactive", label: "Inativos" },
          ]}
          value={filterStatus}
          onChange={(val) => setFilterStatus(val)}
          placeholder="Todos status"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100">
              <th className="px-4 py-3 text-left font-medium text-ink-500">Usuário</th>
              <th className="px-4 py-3 text-left font-medium text-ink-500 hidden md:table-cell">Franquia</th>
              <th className="px-4 py-3 text-left font-medium text-ink-500 hidden lg:table-cell">Roles</th>
              <th className="px-4 py-3 text-left font-medium text-ink-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-ink-500 hidden lg:table-cell">Último acesso</th>
              <th className="px-4 py-3 text-right font-medium text-ink-500">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-400">
                  Nenhum usuário encontrado
                </td>
              </tr>
            ) : (
              filtered.map((user) => {
                const initial = user.full_name?.[0]?.toUpperCase() || "U";
                return (
                  <tr
                    key={user.id}
                    className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white",
                          user.status === "active" ? "bg-brand-olive" : "bg-ink-300"
                        )}>
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900">{user.full_name}</p>
                          {user.is_franchise_admin && (
                            <span className="text-[10px] font-medium text-brand-olive">Admin da franquia</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-ink-600">
                        <Building2 size={13} className="text-ink-400" />
                        <span className="truncate">{user.franchise?.name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {user.user_roles.map((ur) => (
                          <span
                            key={ur.role_id}
                            className="rounded-full bg-brand-olive-soft px-2 py-0.5 text-[11px] font-medium text-brand-olive-dark"
                          >
                            {ur.role.name}
                          </span>
                        ))}
                        {user.user_roles.length === 0 && (
                          <span className="text-ink-400 text-xs">Sem role</span>
                        )}
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
                        {user.status === "active" ? (
                          <><UserCheck size={11} /> Ativo</>
                        ) : (
                          <><UserX size={11} /> Inativo</>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-ink-500">
                      {formatDate(user.last_sign_in_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {user.franchise && (
                          <Link
                            href={`/franquias/${user.franchise.slug}`}
                            className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
                            aria-label="Editar usuário"
                            title="Editar usuário"
                          >
                            <Pencil size={14} />
                          </Link>
                        )}
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={isPending}
                          className="rounded-md p-1.5 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors"
                          aria-label="Remover usuário"
                          title="Remover usuário"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
