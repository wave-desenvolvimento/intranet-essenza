"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Shield } from "lucide-react";
import { createRole, updateRole, deleteRole } from "./actions";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";

interface Permission { id: string; module: string; action: string; description: string }
interface Role {
  id: string; name: string; slug: string | null; description: string | null;
  is_default: boolean; is_system: boolean; level: number;
  role_permissions: { permission_id: string }[];
}
interface Props { roles: Role[]; permissions: Permission[] }

const ACTION_LABELS: Record<string, string> = {
  view: "Ver", view_all: "Ver todos", create: "Criar", edit: "Editar",
  delete: "Excluir", download: "Baixar", manage: "Gerenciar", approve: "Aprovar", export: "Exportar",
};
const MODULE_LABELS: Record<string, string> = {
  dashboard: "Início", inicio: "Início", usuarios: "Usuários", franquias: "Franquias",
  cms: "CMS", templates: "Templates", pedidos: "Pedidos", analytics: "Relatórios",
  relatorios: "Relatórios", "universo-da-marca": "Universo da Marca",
  "material-corporativo": "Material Corp.", campanhas: "Campanhas",
  "redes-sociais": "Redes Sociais", biblioteca: "Biblioteca", videos: "Vídeos",
  treinamento: "Treinamento", cigam: "CIGAM", configuracoes: "Configurações",
};

function groupByModule(permissions: Permission[]) {
  const groups: Record<string, Permission[]> = {};
  for (const p of permissions) {
    if (!groups[p.module]) groups[p.module] = [];
    groups[p.module].push(p);
  }
  return groups;
}

export function PermissionsManager({ roles, permissions }: Props) {
  const [editingRole, setEditingRole] = useState<Role | null>(roles[0] || null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(roles[0]?.role_permissions.map((rp) => rp.permission_id) || [])
  );
  const [name, setName] = useState(roles[0]?.name || "");
  const [description, setDescription] = useState(roles[0]?.description || "");
  const [isSystem, setIsSystem] = useState(roles[0]?.is_system || false);
  const [level, setLevel] = useState(String(roles[0]?.level || 10));
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmAction, dialogProps } = useConfirm();

  const modules = groupByModule(permissions);
  const allActions = [...new Set(permissions.map((p) => p.action))].sort();

  function openCreate() {
    setEditingRole(null); setIsCreating(true);
    setName(""); setDescription(""); setIsSystem(false); setLevel("10");
    setSelectedPermissions(new Set()); setError("");
  }

  function openEdit(role: Role) {
    setEditingRole(role); setIsCreating(false);
    setName(role.name); setDescription(role.description || "");
    setIsSystem(role.is_system); setLevel(String(role.level));
    setSelectedPermissions(new Set(role.role_permissions.map((rp) => rp.permission_id)));
    setError("");
  }

  function togglePermission(id: string) {
    setSelectedPermissions((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleModule(perms: Permission[]) {
    const allSelected = perms.every((p) => selectedPermissions.has(p.id));
    setSelectedPermissions((prev) => { const n = new Set(prev); for (const p of perms) { allSelected ? n.delete(p.id) : n.add(p.id); } return n; });
  }

  function handleSave() {
    const fd = new FormData();
    fd.set("name", name); fd.set("description", description);
    fd.set("isSystem", String(isSystem)); fd.set("level", level);
    for (const pid of selectedPermissions) fd.append("permissions", pid);
    if (editingRole && !isCreating) {
      fd.set("roleId", editingRole.id);
      startTransition(async () => { const r = await updateRole(fd); if (r?.error) setError(r.error); });
    } else {
      startTransition(async () => { const r = await createRole(fd); if (r?.error) setError(r.error); });
    }
  }

  async function handleDelete(roleId: string) {
    const ok = await confirmAction({ title: "Remover tipo de acesso", message: "Tem certeza? Usuários vinculados perderão este acesso.", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => { const r = await deleteRole(roleId); if (r?.error) setError(r.error); });
  }

  const isEditing = isCreating || editingRole !== null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Permissões</h1>
          <p className="text-sm text-ink-500">{roles.length} tipos de acesso</p>
        </div>
      </div>

      <div className="flex gap-5 h-[calc(100vh-160px)]">
        {/* Left — Roles list */}
        <div className="w-52 shrink-0 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-ink-500">Tipos de Acesso</span>
            <button onClick={openCreate} className="rounded-lg p-1 text-ink-400 hover:text-brand-olive hover:bg-brand-olive-soft transition-colors" title="Novo">
              <Plus size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-0.5">
            {roles.map((role) => {
              const isActive = editingRole?.id === role.id && !isCreating;
              return (
                <button
                  key={role.id}
                  onClick={() => openEdit(role)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors w-full",
                    isActive ? "bg-brand-olive-soft text-brand-olive" : "hover:bg-ink-50 text-ink-700"
                  )}
                >
                  <Shield size={13} className={isActive ? "text-brand-olive" : "text-ink-400"} />
                  <div className="flex-1 min-w-0">
                    <span className={cn("text-sm truncate block", isActive && "font-medium")}>{role.name}</span>
                  </div>
                  <span className="text-[8px] text-ink-400 font-mono shrink-0">{role.role_permissions.length}</span>
                </button>
              );
            })}
            {isCreating && (
              <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 bg-brand-olive-soft text-brand-olive">
                <Plus size={13} />
                <span className="text-xs font-medium">Novo tipo</span>
              </div>
            )}
          </div>
        </div>

        {/* Right — Editor */}
        {isEditing && (
          <div className="flex-1 flex flex-col rounded-xl border border-ink-100 bg-white overflow-hidden min-w-0">
            {/* Header fields */}
            <div className="px-5 py-4 border-b border-ink-100 shrink-0">
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="text-xs font-medium text-ink-600 mb-1 block">Nome</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-9 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none" placeholder="Ex: Gerente" />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-600 mb-1 block">Descrição</label>
                  <input value={description} onChange={(e) => setDescription(e.target.value)} className="h-9 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none" placeholder="Opcional" />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-600 mb-1 block">Escopo</label>
                  <div className="flex gap-1 h-8">
                    <button type="button" onClick={() => setIsSystem(true)} className={cn("flex-1 rounded-lg text-xs font-medium transition-colors", isSystem ? "bg-brand-olive text-white" : "bg-ink-50 text-ink-500 hover:bg-ink-100")}>Sistema</button>
                    <button type="button" onClick={() => setIsSystem(false)} className={cn("flex-1 rounded-lg text-xs font-medium transition-colors", !isSystem ? "bg-brand-olive text-white" : "bg-ink-50 text-ink-500 hover:bg-ink-100")}>Franquia</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-600 mb-1 block">Nível</label>
                  <select value={level} onChange={(e) => setLevel(e.target.value)} className="h-9 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none">
                    <option value="100">100 — Super Admin</option>
                    <option value="90">90 — Owner</option>
                    <option value="80">80 — Admin</option>
                    <option value="70">70 — Operacional</option>
                    <option value="50">50 — Comercial</option>
                    <option value="30">30 — Admin Franquia</option>
                    <option value="10">10 — Usuário</option>
                    <option value="0">0 — Visualizador</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Matrix table — scrollable */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-ink-50 border-b border-ink-100">
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-ink-600 sticky left-0 bg-ink-50 min-w-[150px]">Módulo</th>
                    {allActions.map((action) => (
                      <th key={action} className="text-center px-2 py-2.5 text-[10px] font-medium text-ink-500 whitespace-nowrap">{ACTION_LABELS[action] || action}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(modules).map(([module, perms], i) => {
                    const allChecked = perms.every((p) => selectedPermissions.has(p.id));
                    const someChecked = perms.some((p) => selectedPermissions.has(p.id));
                    return (
                      <tr key={module} className={cn("border-b border-ink-50 last:border-0 hover:bg-brand-olive-soft/20 transition-colors", i % 2 === 0 ? "bg-white" : "bg-ink-50/30")}>
                        <td className={cn("px-3 py-2 sticky left-0", i % 2 === 0 ? "bg-white" : "bg-ink-50/30")}>
                          <button type="button" onClick={() => toggleModule(perms)} className="flex items-center gap-2.5">
                            <div className={cn("relative h-[18px] w-8 rounded-full transition-colors shrink-0", allChecked ? "bg-brand-olive" : someChecked ? "bg-brand-olive/40" : "bg-ink-200")}>
                              <div className={cn("absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform", allChecked ? "translate-x-[14px]" : someChecked ? "translate-x-[7px]" : "translate-x-[2px]")} />
                            </div>
                            <span className={cn("text-sm", allChecked || someChecked ? "font-medium text-ink-900" : "text-ink-600")}>{MODULE_LABELS[module] || module}</span>
                          </button>
                        </td>
                        {allActions.map((action) => {
                          const perm = perms.find((p) => p.action === action);
                          if (!perm) return <td key={action} className="text-center px-1.5 py-2"><span className="text-ink-200">—</span></td>;
                          const isOn = selectedPermissions.has(perm.id);
                          return (
                            <td key={action} className="text-center px-1.5 py-2">
                              <button type="button" onClick={() => togglePermission(perm.id)} className="inline-flex items-center justify-center">
                                <div className={cn("h-4 w-4 rounded border-[1.5px] flex items-center justify-center transition-all", isOn ? "bg-brand-olive border-brand-olive" : "border-ink-300 hover:border-ink-400")}>
                                  {isOn && <svg viewBox="0 0 12 12" className="text-white" width={9} height={9}><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                </div>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-5 py-3 border-t border-ink-100 shrink-0 bg-white">
              {error && <p className="text-xs text-danger flex-1">{error}</p>}
              <div className="flex-1" />
              {editingRole && !isCreating && (
                <button onClick={() => handleDelete(editingRole.id)} disabled={isPending} className="rounded-lg px-3 py-2 text-xs font-medium text-danger hover:bg-danger-soft transition-colors">
                  Remover
                </button>
              )}
              <button onClick={handleSave} disabled={isPending || !name} className="rounded-lg bg-brand-olive px-4 py-2 text-xs font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors">
                {isPending ? "Salvando..." : isCreating ? "Criar" : "Salvar"}
              </button>
            </div>
          </div>
        )}

        {!isEditing && (
          <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50">
            <p className="text-sm text-ink-400">Selecione um tipo de acesso</p>
          </div>
        )}
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
