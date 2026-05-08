"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, X, Activity, ExternalLink, Check } from "lucide-react";
import { createMonitor, updateMonitor, deleteMonitor } from "./actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";

interface Monitor {
  id: string;
  name: string;
  group_name: string;
  description: string | null;
  url: string;
  method: string;
  headers: Record<string, string>;
  expected_status: number;
  interval_minutes: number;
  is_active: boolean;
  current_status: string;
  last_checked_at: string | null;
}

interface Props {
  monitors: Monitor[];
}

export function MonitorsManager({ monitors }: Props) {
  const [editing, setEditing] = useState<Monitor | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { dialogProps, confirm } = useConfirm();

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createMonitor(formData);
      if (result?.error) toast.error(result.error);
      else { toast.success("Monitor criado"); setCreating(false); }
    });
  }

  function handleUpdate(formData: FormData) {
    startTransition(async () => {
      const result = await updateMonitor(formData);
      if (result?.error) toast.error(result.error);
      else { toast.success("Monitor atualizado"); setEditing(null); }
    });
  }

  async function handleDelete(id: string) {
    const ok = await confirm({ title: "Remover monitor", message: "O histórico de checks será perdido.", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteMonitor(id);
      if (result?.error) toast.error(result.error);
      else toast.success("Monitor removido");
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Monitors</h1>
          <p className="text-sm text-ink-500">Gerencie os endpoints monitorados na status page</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/status"
            target="_blank"
            className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-600 hover:bg-ink-50 transition-colors"
          >
            <ExternalLink size={14} />
            Ver status page
          </a>
          <button
            onClick={() => { setCreating(true); setEditing(null); }}
            className="flex items-center gap-1.5 rounded-lg bg-brand-olive px-3 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors"
          >
            <Plus size={14} />
            Novo monitor
          </button>
        </div>
      </div>

      {/* Form */}
      {(creating || editing) && (
        <div className="rounded-xl border border-ink-100 bg-white p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink-900">
              {editing ? "Editar monitor" : "Novo monitor"}
            </h2>
            <button onClick={() => { setCreating(false); setEditing(null); }} className="text-ink-400 hover:text-ink-600">
              <X size={16} />
            </button>
          </div>

          <form
            action={editing ? handleUpdate : handleCreate}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {editing && <input type="hidden" name="id" value={editing.id} />}
            {editing && <input type="hidden" name="isActive" value={String(editing.is_active)} />}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">Nome *</label>
              <input
                name="name"
                required
                defaultValue={editing?.name || ""}
                placeholder="Ex: Banco de Dados"
                className="h-10 rounded-lg border border-ink-200 px-3 text-sm focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">Grupo *</label>
              <input
                name="groupName"
                required
                defaultValue={editing?.group_name || ""}
                placeholder="Ex: Supabase, Vercel, Resend"
                className="h-10 rounded-lg border border-ink-200 px-3 text-sm focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
              />
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">Descrição</label>
              <input
                name="description"
                defaultValue={editing?.description || ""}
                placeholder="Ex: PostgreSQL — armazenamento principal de dados"
                className="h-10 rounded-lg border border-ink-200 px-3 text-sm focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">URL *</label>
              <input
                name="url"
                required
                type="url"
                defaultValue={editing?.url || ""}
                placeholder="https://..."
                className="h-10 rounded-lg border border-ink-200 px-3 text-sm focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">Método</label>
              <select
                name="method"
                defaultValue={editing?.method || "GET"}
                className="h-10 rounded-lg border border-ink-200 px-3 text-sm focus:border-brand-olive focus:outline-none"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">Status esperado</label>
              <input
                name="expectedStatus"
                type="number"
                defaultValue={editing?.expected_status || 200}
                className="h-10 rounded-lg border border-ink-200 px-3 text-sm focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">Intervalo (min)</label>
              <input
                name="intervalMinutes"
                type="number"
                min={1}
                defaultValue={editing?.interval_minutes || 5}
                className="h-10 rounded-lg border border-ink-200 px-3 text-sm focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">Headers (JSON)</label>
              <input
                name="headers"
                defaultValue={editing?.headers ? JSON.stringify(editing.headers) : "{}"}
                placeholder='{"apikey": "..."}'
                className="h-10 rounded-lg border border-ink-200 px-3 text-sm font-mono focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setCreating(false); setEditing(null); }}
                className="rounded-lg border border-ink-200 px-4 py-2 text-sm text-ink-600 hover:bg-ink-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-60 transition-colors"
              >
                <Check size={14} />
                {isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="rounded-xl border border-ink-100 bg-white divide-y divide-ink-50">
        {monitors.length === 0 && (
          <div className="px-6 py-12 text-center">
            <Activity size={32} className="mx-auto text-ink-300 mb-3" />
            <p className="text-sm text-ink-500">Nenhum monitor configurado</p>
          </div>
        )}

        {monitors.map((monitor) => (
          <div key={monitor.id} className="flex items-center gap-4 px-5 py-4">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full shrink-0",
                monitor.current_status === "up" && "bg-emerald-500",
                monitor.current_status === "down" && "bg-red-500",
                monitor.current_status === "unknown" && "bg-ink-300",
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink-900">{monitor.name}</span>
                <span className="text-[10px] bg-ink-50 text-ink-500 px-1.5 py-0.5 rounded">{monitor.group_name}</span>
                {!monitor.is_active && (
                  <span className="text-[10px] bg-ink-100 text-ink-500 px-1.5 py-0.5 rounded">Inativo</span>
                )}
              </div>
              <p className="text-xs text-ink-400 truncate">{monitor.description || monitor.url}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-ink-400">
              <span>{monitor.method}</span>
              <span>a cada {monitor.interval_minutes}min</span>
              {monitor.last_checked_at && (
                <span title={monitor.last_checked_at}>
                  {new Date(monitor.last_checked_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setEditing(monitor); setCreating(false); }}
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700 transition-colors"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => handleDelete(monitor.id)}
                className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
