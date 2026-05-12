"use client";

import { useState, useTransition } from "react";
import {
  Search, History, Plus, Pencil, Trash2, CheckCheck, UserPlus, LogIn,
  Package, ShoppingCart, Building2, Users, Megaphone, FileText, Settings,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { getAuditLog } from "./actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AuditEntry { [key: string]: any; }

interface Props {
  entries: AuditEntry[];
  total: number;
}

const PER_PAGE = 20;

const ACTION_CONFIG: Record<string, { icon: typeof Plus; color: string; bg: string; label: string }> = {
  create: { icon: Plus, color: "text-success", bg: "bg-success-soft", label: "Criação" },
  update: { icon: Pencil, color: "text-info", bg: "bg-info-soft", label: "Edição" },
  delete: { icon: Trash2, color: "text-danger", bg: "bg-danger-soft", label: "Exclusão" },
  approve: { icon: CheckCheck, color: "text-brand-olive", bg: "bg-brand-olive-soft", label: "Aprovação" },
  invite: { icon: UserPlus, color: "text-info", bg: "bg-info-soft", label: "Convite" },
  login: { icon: LogIn, color: "text-ink-500", bg: "bg-ink-100", label: "Login" },
};

const ENTITY_ICONS: Record<string, typeof Package> = {
  order: ShoppingCart,
  product: Package,
  franchise: Building2,
  user: Users,
  announcement: Megaphone,
  cms_item: FileText,
  stock: Package,
  permission: Settings,
};

const ENTITY_OPTIONS = [
  { value: "", label: "Todos os tipos" },
  { value: "order", label: "Pedidos" },
  { value: "product", label: "Produtos" },
  { value: "franchise", label: "Franquias" },
  { value: "user", label: "Usuários" },
  { value: "announcement", label: "Comunicados" },
  { value: "stock", label: "Estoque" },
  { value: "cms_item", label: "Conteúdo" },
];

const ACTION_OPTIONS = [
  { value: "", label: "Todas as ações" },
  { value: "create", label: "Criação" },
  { value: "update", label: "Edição" },
  { value: "delete", label: "Exclusão" },
  { value: "approve", label: "Aprovação" },
  { value: "invite", label: "Convite" },
];

export function AuditViewer({ entries: initialEntries, total: initialTotal }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(total / PER_PAGE);

  function fetchPage(newPage: number, entity?: string, action?: string) {
    startTransition(async () => {
      const { entries: data, total: count } = await getAuditLog({
        entityType: (entity ?? filterEntity) || undefined,
        action: (action ?? filterAction) || undefined,
        limit: PER_PAGE,
        offset: newPage * PER_PAGE,
      });
      setEntries(data);
      setTotal(count);
      setPage(newPage);
    });
  }

  function handleFilterEntity(v: string) {
    setFilterEntity(v);
    fetchPage(0, v, filterAction);
  }

  function handleFilterAction(v: string) {
    setFilterAction(v);
    fetchPage(0, filterEntity, v);
  }

  // Client-side search within loaded page
  const displayed = search
    ? entries.filter((e) =>
        e.description?.toLowerCase().includes(search.toLowerCase()) ||
        e.user_name?.toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  function formatDate(d: string) {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);

    if (diffMin < 1) return "Agora";
    if (diffMin < 60) return `${diffMin}min atrás`;
    if (diffHrs < 24) return `${diffHrs}h atrás`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  const from = page * PER_PAGE + 1;
  const to = Math.min((page + 1) * PER_PAGE, total);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Histórico de Ações</h1>
          <p className="text-sm text-ink-500">{total} registro{total !== 1 ? "s" : ""} no log</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
        <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white py-1 px-3 h-9 flex-1">
          <Search size={14} className="text-ink-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por descrição ou usuário..." className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none" />
        </div>
        <CustomSelect options={ENTITY_OPTIONS} value={filterEntity} onChange={handleFilterEntity} />
        <CustomSelect options={ACTION_OPTIONS} value={filterAction} onChange={handleFilterAction} />
      </div>

      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 py-16">
          <History size={32} className="text-ink-300 mb-2" />
          <p className="text-sm text-ink-400">Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className={cn("rounded-xl border border-ink-100 bg-white overflow-hidden", isPending && "opacity-60")}>
          <div className="divide-y divide-ink-50">
            {displayed.map((e) => {
              const actionCfg = ACTION_CONFIG[e.action] || ACTION_CONFIG.update;
              const ActionIcon = actionCfg.icon;
              const EntityIcon = ENTITY_ICONS[e.entity_type] || FileText;

              return (
                <div key={e.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-ink-50/50 transition-colors">
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5", actionCfg.bg)}>
                    <ActionIcon size={14} className={actionCfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-900">{e.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-ink-400 flex-wrap">
                      <span className="font-medium text-ink-600">{e.user_name || "Sistema"}</span>
                      <span className="flex items-center gap-1">
                        <EntityIcon size={10} />
                        {ENTITY_OPTIONS.find((o) => o.value === e.entity_type)?.label || e.entity_type}
                      </span>
                      <span className={cn("inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium", actionCfg.bg, actionCfg.color)}>{actionCfg.label}</span>
                      <span>{formatDate(e.created_at)}</span>
                    </div>
                    {e.changes && Object.keys(e.changes).length > 0 && (
                      <details className="mt-1.5">
                        <summary className="text-[10px] text-ink-400 cursor-pointer hover:text-ink-600">Ver alterações</summary>
                        <div className="mt-1 rounded-md bg-ink-50 px-3 py-2 text-[11px] font-mono text-ink-600">
                          {Object.entries(e.changes as Record<string, { old: unknown; new: unknown }>).map(([field, val]) => (
                            <div key={field}>
                              <span className="text-ink-400">{field}:</span>{" "}
                              <span className="text-danger line-through">{String(val.old ?? "—")}</span>{" → "}
                              <span className="text-success">{String(val.new ?? "—")}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {total > PER_PAGE && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-ink-400">
            {from}–{to} de {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchPage(page - 1)}
              disabled={page === 0 || isPending}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-ink-100 text-ink-500 hover:bg-ink-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i).map((p) => (
              <button
                key={p}
                onClick={() => fetchPage(p)}
                disabled={isPending}
                className={cn(
                  "flex items-center justify-center h-8 min-w-[32px] rounded-lg text-xs font-medium transition-colors",
                  p === page
                    ? "bg-brand-olive text-white"
                    : "border border-ink-100 text-ink-600 hover:bg-ink-50"
                )}
              >
                {p + 1}
              </button>
            ))}
            <button
              onClick={() => fetchPage(page + 1)}
              disabled={page >= totalPages - 1 || isPending}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-ink-100 text-ink-500 hover:bg-ink-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
